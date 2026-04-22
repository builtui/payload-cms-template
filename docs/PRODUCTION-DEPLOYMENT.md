# Production Deployment — Payload CMS + Next.js auf Hetzner Cloud

Konsolidierte Setup-Anleitung und Learnings aus zwei Live-Deployments dieses Templates
(`boothside.com`, `ludwigmoeller.de`). Beschreibt den **nativen Stack** — Docker ist
für single-tenant, single-site Deployments overkill.

> **TL;DR:** Hetzner CX22 (Ubuntu 24.04) → nginx + PM2 + systemd + Postgres + Let's Encrypt.
> Kein Docker. Kein Caddy. ~30 Min von "fresh VM" bis "live mit SSL".

---

## Architektur-Übersicht

```
┌──────────────────────────────────────────────────────────────────┐
│ Hetzner Cloud VM (Ubuntu 24.04 LTS, CX22: 2 vCPU / 4 GB RAM)     │
│                                                                  │
│  Internet ──▶ UFW (22/80/443) ──▶ nginx (Reverse Proxy + SSL)    │
│                                       │                          │
│                                       ├─▶ /        ──▶ Next.js   │
│                                       ├─▶ /admin   ──▶ Next.js   │
│                                       ├─▶ /api/*   ──▶ Next.js   │
│                                       └─▶ /_next/image ──▶ cache │
│                                                       (2 GB)     │
│                                                                  │
│  Next.js (PM2 fork-mode, user 'app', Port 3000 localhost)        │
│         │                                                        │
│         └──▶ PostgreSQL 16 (localhost:5432, scram-sha-256)       │
│                                                                  │
│  Backups: /var/backups/postgresql (täglich, 14d Retention)       │
│  Logs:    /var/log/<app> (PM2 stdout/stderr)                     │
│  fail2ban: sshd + nginx-http-auth + nginx-limit-req              │
│  certbot.timer (auto-renew Let's Encrypt)                        │
└──────────────────────────────────────────────────────────────────┘
```

**Warum nicht Docker?** Single-site Deployments zahlen Docker-Komplexität ohne Nutzen.
Native Pakete sind unkompliziert zu debuggen, brauchen weniger RAM, und systemd verwaltet
Lifecycle und Logs sauber. Docker ergibt Sinn ab Multi-Service-Stacks oder CI/CD-Pipelines.

---

## 0. Pre-Flight (lokal)

```bash
# 1. .env.production.example als Vorlage
cp .env.example .env.production

# 2. Secrets generieren (lokal, einmal)
echo "POSTGRES_PASSWORD=$(openssl rand -hex 20)" >> .env.production
echo "PAYLOAD_SECRET=$(openssl rand -hex 32)" >> .env.production
echo "BASIC_AUTH_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)" >> .env.production

# 3. bcrypt-Hash für nginx Basic Auth (Pre-Launch-Schutz)
htpasswd -bnBC 12 "" "$BASIC_AUTH_PASSWORD" | tr -d ':\n' | sed 's/^\$2y/\$2a/'
```

**Speichere alle Secrets in einem Passwort-Manager.** Nie in Git, nie als Plaintext im Projekt.

---

## 1. Server vorbereiten

```bash
ssh root@<server-ip>

# System
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y
apt-get install -y \
  nginx \
  postgresql-16 postgresql-contrib \
  certbot python3-certbot-nginx \
  apache2-utils \
  ufw fail2ban \
  ffmpeg \
  git curl ca-certificates rsync build-essential \
  unattended-upgrades

# Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Auto-Security-Updates
dpkg-reconfigure -f noninteractive unattended-upgrades

# SSH-Härtung (Drop-in survives upgrades)
cat > /etc/ssh/sshd_config.d/50-harden.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t && systemctl reload ssh
```

**`ffmpeg`** wird vom Payload-Sharp-Pipeline für Video-Transcoding gebraucht
(`@payloadcms/plugin-form-builder` oder Upload-Hooks für Videos). Wenn es fehlt,
schlägt der Upload mit `spawn ffmpeg ENOENT` fehl, ohne klare Diagnose.

---

## 2. Node.js 20 + pnpm + PM2

```bash
# Node 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# pnpm via corepack (kein npm install -g pnpm — kollidiert mit corepack)
corepack enable
corepack prepare pnpm@10 --activate

# PM2 global
npm install -g pm2
```

---

## 3. App-User + Verzeichnisse

```bash
# Convention: User-Name = App-Name (kurz, ohne Domain-Suffix)
APP=ludwigmoeller   # oder: boothside, etc.

useradd -m -d /home/$APP -s /bin/bash $APP
mkdir -p /opt/$APP /opt/$APP/media /var/log/$APP /var/backups/postgresql
chown $APP:$APP /opt/$APP /var/log/$APP
chmod 700 /var/backups/postgresql
```

**Warum `/opt/<app>/` und nicht `/home/<app>/<app>/`?** Konvention für third-party
Software auf FHS-Linux. `/home/<app>` bleibt für PM2-State (`.pm2/`).

---

## 4. PostgreSQL Setup

```bash
APP=ludwigmoeller
DB=$APP
USER=$APP
PASS='<from-password-manager>'

# DB + User idempotent anlegen
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $USER WITH PASSWORD '$PASS';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB OWNER $USER;"

# Auth: scram-sha-256 (NICHT md5, NICHT trust)
PG_HBA=/etc/postgresql/16/main/pg_hba.conf
grep -E "^host\s+$DB\s+$USER" $PG_HBA || \
  echo "host    $DB    $USER    127.0.0.1/32    scram-sha-256" >> $PG_HBA

systemctl reload postgresql

# Verifizieren: lauscht NUR auf localhost
ss -tlnp | grep 5432   # → erwarte nur 127.0.0.1 / [::1]

# Connection-Test
PGPASSWORD="$PASS" psql -h 127.0.0.1 -U $USER -d $DB -c 'SELECT version();'
```

**Wichtig:**

- Ubuntu's Default ist `listen_addresses = 'localhost'` — extern unerreichbar. Lass es so.
- Der App-User ist explizit **kein Superuser** (`rolsuper=f, rolcreatedb=f, rolcreaterole=f`).
- Für Multi-App-Postgres-Setups (1 Server, mehrere Sites): jede App eigener DB-User,
  damit ein kompromittierter App-User nicht andere Datenbanken sieht.

---

## 5. Code deployen (rsync von lokal)

```bash
APP=ludwigmoeller

rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='media' \
  --exclude='.env' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  ./ root@<server>:/opt/$APP/

ssh root@<server> "chown -R $APP:$APP /opt/$APP"
```

`media/` wird **nicht** mitgerysynced — Production hat eigene Uploads. Bei Migration
von lokal: `rsync -az ./media/ root@server:/opt/$APP/media/` separat.

---

## 6. .env auf Server schreiben

```bash
ssh root@<server>
cat > /opt/$APP/.env <<EOF
DATABASE_URL=postgresql://$USER:$PASS@127.0.0.1:5432/$DB
PAYLOAD_SECRET=<from-password-manager>
NEXT_PUBLIC_SITE_URL=https://example.com
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
NEXT_TELEMETRY_DISABLED=1
EOF
chown $APP:$APP /opt/$APP/.env
chmod 600 /opt/$APP/.env   # ← KRITISCH: nur app-user darf lesen
```

---

## 7. Build + Schema-Migration

```bash
sudo -u $APP -H bash -c "cd /opt/$APP && pnpm install --frozen-lockfile"

# Build (lädt .env automatisch)
sudo -u $APP -H bash -c "cd /opt/$APP && set -a && source .env && set +a && pnpm build"

# Schema-Migration: ZWEI Schritte!
sudo -u $APP -H bash -c "cd /opt/$APP && set -a && source .env && set +a && \
  pnpm payload migrate:create initial --force-accept-warning && \
  pnpm payload migrate"
```

> **GOTCHA #1:** Payload v3 pusht das Schema **NICHT** automatisch beim App-Start in
> Production. Du brauchst explizit eine Migration. Wenn die fehlt, läuft die App,
> aber jede DB-Query gibt `relation "..." does not exist` (Postgres-Code 42P01).
>
> Auch wenn `db.push: true` in der Config gesetzt ist — das gilt nur für `pnpm dev`.

> **GOTCHA #2:** `migrate:create` ist normalerweise interaktiv (fragt bei
> Schema-Änderungen "Rename oder Drop+Create?"). Für die initiale Migration mit
> leerer DB sollte `--force-accept-warning` reichen. Bei späteren Schema-Diffs
> entweder manuell SSH-Session, oder `expect`/`yes ""` Pipe.

---

## 8. PM2 + systemd

```bash
APP=ludwigmoeller

cat > /opt/$APP/ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: '$APP',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000 -H 127.0.0.1',
    cwd: '/opt/$APP',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production', NODE_OPTIONS: '--no-deprecation' },
    out_file: '/var/log/$APP/out.log',
    error_file: '/var/log/$APP/err.log',
    merge_logs: true,
    time: true,
  }],
}
EOF
chown $APP:$APP /opt/$APP/ecosystem.config.cjs

# Start als app-user
sudo -u $APP -H bash -c "cd /opt/$APP && pm2 start ecosystem.config.cjs && pm2 save"

# systemd-Hook (überlebt Reboots)
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP --hp /home/$APP | tail -3 | head -1 | bash
systemctl enable pm2-$APP
systemctl status pm2-$APP --no-pager
```

> **GOTCHA #3:** `script: 'pnpm'` mit `args: 'start'` funktioniert in PM2 oft nicht
> (kein TTY, exit-code-Handling). Direkt das `next` Binary aus `node_modules` —
> robuster.

---

## 9. nginx Site-Config

`/etc/nginx/conf.d/zones.conf` (globale Zonen — einmal pro Server):

```nginx
# Image-Cache für /_next/image
proxy_cache_path /var/cache/nginx/images
                 levels=1:2
                 keys_zone=nextimg:100m
                 max_size=2g
                 inactive=30d
                 use_temp_path=off;

# Rate-Limit-Zonen
limit_req_zone $binary_remote_addr zone=admin_login:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
```

```bash
mkdir -p /var/cache/nginx/images
chown -R www-data:www-data /var/cache/nginx/images
```

`/etc/nginx/sites-available/<app>` (HTTP-only — certbot fügt HTTPS-Block automatisch hinzu):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    client_max_body_size 50m;

    gzip on;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/xml+rss application/atom+xml image/svg+xml;
    gzip_min_length 1024;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    # Pre-Launch:
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;

    # Pre-Launch Basic Auth (entfernen bei Go-Live, siehe unten)
    auth_basic "<App> — Pre-launch (noch nicht öffentlich)";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # Image-Optimizer MUSS Basic Auth bypassen, sonst keine Bilder
    location /_next/image {
        auth_basic off;
        proxy_cache nextimg;
        proxy_cache_key "$scheme$host$request_uri";
        proxy_cache_valid 200 30d;
        proxy_cache_lock on;
        proxy_cache_revalidate on;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header X-Cache-Status $upstream_cache_status always;
    }

    location /_next/static {
        auth_basic off;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Payload-API: kein Basic Auth (Kontaktformular, interne Calls)
    location /api/ {
        auth_basic off;
        limit_req zone=api burst=30 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    # Admin-Login mit Brute-Force-Schutz
    location /api/users/login {
        auth_basic off;
        limit_req zone=admin_login burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend + /admin (Basic Auth aktiv)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# htpasswd anlegen (bcrypt, NICHT default md5/apr1)
htpasswd -cbB /etc/nginx/.htpasswd preview '<password>'
chown root:www-data /etc/nginx/.htpasswd
chmod 640 /etc/nginx/.htpasswd

# Default-Site weg
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/<app> /etc/nginx/sites-enabled/<app>

nginx -t && systemctl reload nginx
```

> **GOTCHA #4:** `auth_basic off` MUSS auch `/_next/image` und `/_next/static` umfassen
> — sonst lädt das Frontend keine Bilder und keine JS-Bundles, weil der Browser für
> `<img>`-Requests keinen Auth-Header schickt.

> **GOTCHA #5:** Basic Auth gehört in nginx, **nicht** in eine Next.js-Middleware:
>
> - Blockt auf Layer 7 → Bot-Scraper, Link-Previews, Page-Speed-Tools sehen nichts
> - `/admin` funktioniert trotzdem (Payload hat eigene Login-Maske dahinter)
> - 2-Zeilen-Edit zum Ein-/Ausschalten, kein Code-Deploy
> - fail2ban kann nginx-Auth-Fails automatisch bannen

---

## 10. Let's Encrypt SSL

```bash
certbot --nginx --non-interactive --agree-tos \
  --email admin@example.com \
  --redirect \
  -d example.com -d www.example.com

systemctl status certbot.timer    # → active (running)
```

certbot patcht den 80er-Block (HTTP→HTTPS-Redirect) und fügt einen 443er-Block mit
SSL-Konfig hinzu. Auth-Direktiven, location-Blocks etc. bleiben erhalten.

ACME-HTTP-01-Challenges gehen durch Basic Auth durch — certbot exponed
`/.well-known/acme-challenge/` separat.

---

## 11. fail2ban Jails

`/etc/fail2ban/jail.local`:

```ini
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled  = true
backend  = systemd
maxretry = 3

[nginx-http-auth]
enabled  = true
logpath  = /var/log/nginx/error.log
maxretry = 5

[nginx-limit-req]
enabled  = true
logpath  = /var/log/nginx/error.log
maxretry = 10
findtime = 10m
bantime  = 30m
```

```bash
systemctl restart fail2ban
fail2ban-client status      # → 3 jails
```

Auf Boothside hat das die SSH-Brute-Force-Versuche von ~4700/Tag auf <100 reduziert.

---

## 12. DB-Backups (täglich)

`/usr/local/bin/<app>-db-backup`:

```bash
#!/bin/bash
set -euo pipefail
BACKUP_DIR=/var/backups/postgresql
KEEP_DAYS=14
DB_NAME=ludwigmoeller   # ← anpassen
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
TARGET="$BACKUP_DIR/${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"
sudo -u postgres pg_dump --no-owner --no-acl "$DB_NAME" | gzip -9 > "$TARGET"
chmod 600 "$TARGET"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${KEEP_DAYS} -delete
```

```bash
chmod 750 /usr/local/bin/<app>-db-backup
ln -sf /usr/local/bin/<app>-db-backup /etc/cron.daily/<app>-db-backup
/usr/local/bin/<app>-db-backup   # Initial-Test
```

**Empfehlung zusätzlich:** Hetzner Snapshot-Backup aktivieren (~0,50 €/Mo) als
Disaster-Recovery-Layer für das gesamte VM-Image. Off-Site nach Hetzner Storage Box
(~3 €/Mo) für die Paranoia-Schicht.

---

## Updates deployen (von lokal)

```bash
# Lokal:
rsync -az \
  --exclude='.git' --exclude='node_modules' --exclude='.next' \
  --exclude='media' --exclude='.env' --exclude='.DS_Store' \
  ./ root@<server>:/opt/<app>/

ssh root@<server> "
chown -R <app>:<app> /opt/<app> && \
sudo -u <app> -H bash -c 'cd /opt/<app> && \
  pnpm install --frozen-lockfile && \
  pnpm payload migrate && \
  pnpm build && \
  pm2 restart <app>'
"
```

> **GOTCHA #6:** `rm -rf .next` killt den Image-Cache. Wenn du den .next-Ordner
> aufräumen musst, lösche selektiv `.next/{server,static,types,build-manifest.json,
> app-build-manifest.json}` — **nicht** den ganzen Ordner.

---

## Pre-Launch → Go-Live Checkliste

Wenn die Site öffentlich gehen soll:

1. **Basic Auth raus** (`/etc/nginx/sites-available/<app>`):
   ```nginx
   # Diese 2 Zeilen löschen:
   #   auth_basic "...";
   #   auth_basic_user_file /etc/nginx/.htpasswd;
   ```
   `auth_basic off` in `/api/`, `/_next/image`, `/_next/static` kann drin bleiben — schadet nicht.

2. **`X-Robots-Tag noindex` raus** (siehe nginx-Config oben).

3. **HSTS-Header dauerhaft setzen** (war initial bewusst kurz, falls SSL-Issue):
   ```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
   ```

4. **DB-Strategie umstellen** (bei diesem Template):
   - In `payload.config.ts` ggf. vorhandenes `db.push` deaktivieren / entfernen
   - Ab jetzt nur noch `pnpm payload migrate:create <name>` für Schema-Änderungen

5. **`sitemap.xml` und `robots.txt` prüfen** (sind in `src/app/`, nicht `(frontend)/`).

6. `nginx -t && systemctl reload nginx`

---

## Häufige Stolpersteine (Gotchas im Detail)

### Build-Fehler durch `seed.ts` / `seed.example.ts`

Next.js' Build-Step läuft TypeScript über das gesamte Projekt. Dev-Scripts wie
`src/seed.ts` bringen oft Type-Errors mit (Lexical-Richtext-Helper, optionale
Felder). Nicht in den Build relevant, aber er bricht trotzdem.

**Fix** in `tsconfig.json`:
```json
{
  "exclude": [
    "node_modules",
    "**/*.example.ts",
    "**/*.example.tsx",
    "src/seed.ts"
  ]
}
```

### `output: 'standalone'` in `next.config.ts`

Nur für Docker. Bei `next start` (PM2) muss das **raus**, sonst werden Pages-Files
falsch ausgeliefert.

```ts
// next.config.ts
const nextConfig: NextConfig = {
  // output: 'standalone',  ← entfernen für native Deploy
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'example.com' },
      { protocol: 'https', hostname: 'www.example.com' },
    ],
  },
  poweredByHeader: false,
}
```

### `generateStaticParams` muss in try/catch

Wenn die DB beim Build (CI ohne DB) oder beim Cold-Start (DB noch nicht erreichbar)
nicht antwortet, crasht `next build`. Lösung:

```tsx
export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const pages = await payload.find({ collection: 'pages', limit: 100 })
    return pages.docs.map((p) => ({ slug: p.slug }))
  } catch {
    return []   // → on-demand generation beim ersten Request
  }
}
```

### Localized Arrays ohne Item-IDs überschreiben andere Locales

Wenn du `payload.update()` auf einer Collection mit lokalisiertem Array aufrufst,
und die Items keine `id` haben, geht Payload davon aus es seien neue Items —
und löscht die anderen Locales. Immer fetch → merge mit IDs → update.

### Upload-Collections + Volltextsuche im Admin

Bei Upload-Collections muss `useAsTitle: 'filename'` (nicht ein berechnetes Feld)
gesetzt sein, und `listSearchableFields` darf **nur** Text-Felder enthalten —
keine `select`/`enum`-Felder. Sonst crasht der Postgres-Query mit
`unknown enum value`.

### `plugin-seo` + custom `seoFields` = doppelte DB-Spalten

`@payloadcms/plugin-seo` legt eigene Felder an (`meta.title`, `meta.description`,
`meta.image`). Wenn du zusätzlich custom `seo`-Felder definierst, hast du beides
doppelt in der DB. Eins entscheiden.

### Postgres-Query "unknown locale"

Wenn `localization.locales` in `payload.config.ts` geändert wird (Locale entfernt),
gibt's verwaiste `_locales`-Tabellen-Rows mit alten Locale-Codes. Cleanup:
```sql
DELETE FROM <collection>_locales WHERE _locale NOT IN ('de', 'en');
```

---

## Sicherheits-Audit-Quick-Check

Nach dem Setup laufen lassen:

```bash
# Postgres lauscht NUR auf localhost?
ss -tlnp | grep 5432
# → erwarte: 127.0.0.1:5432 + [::1]:5432, KEIN 0.0.0.0

# .env hat 600 + app:app Ownership?
stat -c '%a %U:%G' /opt/<app>/.env
# → erwarte: 600 <app>:<app>

# htpasswd hat 640 + root:www-data?
stat -c '%a %U:%G' /etc/nginx/.htpasswd
# → erwarte: 640 root:www-data

# certbot.timer aktiv?
systemctl is-enabled certbot.timer

# fail2ban aktiv mit allen jails?
fail2ban-client status

# UFW nur 22/80/443?
ufw status

# SSH erlaubt kein PasswordAuth?
sshd -T 2>/dev/null | grep -E '^(passwordauthentication|kbdinteractiveauthentication)'
# → erwarte: passwordauthentication no, kbdinteractiveauthentication no

# DB-User ist KEIN Superuser?
sudo -u postgres psql -c "\du <app>" | grep -i super
# → erwarte: leer
```

---

## Hardware-Empfehlung Hetzner Cloud

| Größe       | Specs                | Preis     | Eignung                                              |
|-------------|----------------------|-----------|------------------------------------------------------|
| **CX22**    | 2 vCPU / 4 GB / 40GB | ~4,50 €/M | Single-Site, niedrige Last, ideal für Pre-Launch     |
| **CX32**    | 4 vCPU / 8 GB / 80GB | ~7,50 €/M | Mehrere Sites, Bilder-lastig, oder >1k Pageviews/Tag |
| **CCX13**   | 2 dedicated / 8 GB   | ~13 €/M   | Wenn `next build` regelmäßig OOM wirft               |

**Snapshot-Backup**: zusätzlich ~0,50 €/Mo, täglich automatisch. Aktivieren.

---

## Quellen

- Eigene Erfahrung aus den Deployments `boothside.com` und `ludwigmoeller.de`
- [Payload CMS v3 Migrationsdocs](https://payloadcms.com/docs/database/migrations)
- [Next.js Production Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
- [nginx fail2ban-Patterns](https://github.com/fail2ban/fail2ban/tree/master/config/filter.d)
