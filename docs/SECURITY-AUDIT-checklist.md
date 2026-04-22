# Security & Production Audit Checklist

Komplette Prüfliste für jedes neue Payload-CMS-Projekt **vor Go-Live** und
in regelmäßigen Abständen danach (empfohlen: quartalsweise).

Jeder Punkt hat ein konkretes Check-Command + erwartete Antwort + Fix wenn
nicht erfüllt. Alles server-seitig per SSH ausführbar.

---

## Voraussetzung: SSH-Verbindung

```bash
# Falls 1Password SSH-Agent:
export SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
ssh <host-alias>
```

---

## 1. Secrets & Credentials

### ☐ `.env` File-Permissions (600, owned by app-user)
```bash
stat -c "%a %U:%G  %n" /opt/<app>/.env
# Erwartet: 600 <app>:<app>
# Fix:      chmod 600 /opt/<app>/.env && chown <app>:<app> /opt/<app>/.env
```

### ☐ Alle Secrets aus Default-Werten rotiert
Bootstrap-Installer verwenden oft `devpwd` oder ähnlich. Vor Go-Live zu
random 24+ Zeichen rotieren:
```bash
# Check ob default-pw noch aktiv ist (should be 0)
grep -c "devpwd\|changeme\|password123" /opt/<app>/.env
```

### ☐ `PAYLOAD_SECRET` mindestens 32 Zeichen
```bash
awk -F= '/^PAYLOAD_SECRET=/ { print length($2) }' /opt/<app>/.env
# Erwartet: 32 oder mehr (64 ist Standard für openssl rand -hex 32)
# Fix: openssl rand -hex 32, dann .env + pm2 restart
```

### ☐ Alle Secrets in 1Password gespeichert
Pro Projekt sollten mindestens diese Items existieren (im `dev`-Vault):
- **Database** (PostgreSQL): hostname/port/db/user/password
- **Login** (App-Admin oder Basic Auth): url/username/password
- **Server** (SSH): hostname/port/user + setup-notes
- **Password** (PAYLOAD_SECRET): password only

```bash
op --account <acct> item list --vault dev --tags <project> 2>&1 | head -10
```

### ☐ Keine Secrets im Git-Repo
```bash
# .env nie getrackt?
git ls-files | grep -E "\.env$"   # sollte leer sein

# .env in .gitignore?
grep -E "^\.env$|^\.env\..*\$" .gitignore

# Hardcoded prod-passwords im Code?
grep -rnE "postgres://[^:]+:[^@]+@" src/ --exclude-dir=node_modules | \
  grep -v "localhost\|devpwd\|example"
```

---

## 2. Network & Firewall

### ☐ Datenbank lauscht nur auf localhost
```bash
ss -tlnp | grep 5432
# Erwartet: nur 127.0.0.1:5432 und [::1]:5432
# Fix: /etc/postgresql/*/main/postgresql.conf → listen_addresses = 'localhost'
```

### ☐ UFW aktiv, nur notwendige Ports offen
```bash
ufw status
# Erwartet: SSH + 80/tcp + 443/tcp ALLOW (kein direktes 3000 oder 5432)
```

### ☐ Keine unerwünschten Services extern exposed
```bash
ss -tlnp | awk '$4 ~ /^0\.0\.0\.0:/ || $4 ~ /^\[::\]:/ { print $4, $NF }'
# Erwartet: nur 22, 80, 443
```

---

## 3. SSH hardening

### ☐ `PasswordAuthentication no`
```bash
grep -iE "^PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
# Erwartet: "PasswordAuthentication no"
# Fix:
cat > /etc/ssh/sshd_config.d/50-harden.conf <<EOF
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sshd -t && systemctl reload ssh
```

### ☐ Root-Login nur per Key
```bash
grep -iE "^PermitRootLogin" /etc/ssh/sshd_config
# Erwartet: "PermitRootLogin prohibit-password" oder "no"
```

### ☐ Fail2ban aktiv
```bash
systemctl is-enabled fail2ban
fail2ban-client status
# Erwartet: "Number of jail: 2+" mit mindestens sshd + nginx-http-auth
```

### ☐ Bei Basic-Auth: htpasswd-File nicht world-readable
```bash
stat -c "%a %U:%G  %n" /etc/nginx/.htpasswd
# Erwartet: 640 root:www-data (oder 600 root:root)
# Fix:      chown root:www-data /etc/nginx/.htpasswd && chmod 640 <file>
```

---

## 4. TLS / SSL

### ☐ Zertifikat valid + auto-renewal
```bash
certbot certificates | grep -E "(Certificate Name|Expiry)"
systemctl is-enabled certbot.timer
systemctl list-timers certbot.timer --no-pager | head -3
# Erwartet: Timer enabled + next run innerhalb der nächsten Tage
```

### ☐ Modern TLS (1.2+, kein TLS 1.0/1.1)
```bash
echo | openssl s_client -servername <domain> -connect <domain>:443 2>/dev/null | grep "Protocol "
# Erwartet: TLSv1.2 oder TLSv1.3, nicht TLSv1/TLSv1.1
```

### ☐ HSTS aktiv
```bash
curl -sI https://<domain>/ | grep -i strict-transport-security
# Erwartet: "max-age=<sekunden>; includeSubDomains"
# Nach Bewährung: max-age=31536000; includeSubDomains; preload
```

### ☐ HTTP → HTTPS redirect
```bash
curl -sI http://<domain>/ | grep -iE "(HTTP|location)"
# Erwartet: 301 mit location: https://<domain>/
```

---

## 5. Security Headers

### ☐ Alle 5 standard security headers gesetzt
```bash
curl -sI https://<domain>/ | grep -iE "(strict-transport|x-content|x-frame|referrer|permissions)"
# Erwartet: alle 5:
# strict-transport-security: ...
# x-content-type-options: nosniff
# x-frame-options: SAMEORIGIN
# referrer-policy: strict-origin-when-cross-origin
# permissions-policy: camera=(), microphone=(), geolocation=()
```

---

## 6. Backups

### ☐ Backup-Cron aktiv
```bash
ls -la /etc/cron.daily/<app>-db-backup
# Erwartet: symlink auf /usr/local/bin/<app>-db-backup (ausführbar)
```

### ☐ Letzter Backup ≤ 24h alt
```bash
ls -t /var/backups/postgresql/ | head -1
ls -lh /var/backups/postgresql/$(ls -t /var/backups/postgresql/ | head -1)
# Erwartet: heutiges oder gestriges Datum, reasonable size
```

### ☐ Backup-Integrity (dump startet mit valid header)
```bash
LATEST=$(ls -t /var/backups/postgresql/ | head -1)
zcat /var/backups/postgresql/$LATEST | head -2
# Erwartet: "-- PostgreSQL database dump"
```

### ☐ Retention nicht überfüllt
```bash
ls /var/backups/postgresql/ | wc -l
# Erwartet: ≤ KEEP_DAYS (default 14)
```

### ☐ Off-Server-Backup vorhanden
z.B. Hetzner Volume-Snapshots, S3-Sync, oder externes `rclone`-Mount.
Ohne off-server-Backup: bei Totalausfall = Datenverlust.

---

## 7. Database

### ☐ App-User ist kein Superuser
```bash
sudo -u postgres psql -c "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolcanlogin;"
# Erwartet: App-user hat rolsuper=f, rolcreatedb=f, rolcreaterole=f
```

### ☐ scram-sha-256 für Password-Hashing
```bash
grep -v "^#\|^$" /etc/postgresql/*/main/pg_hba.conf | head -10
# Erwartet: "scram-sha-256" nicht "md5" oder "trust" (außer local socket mit peer)
```

---

## 8. System Updates

### ☐ Security Updates installiert
```bash
apt list --upgradable 2>/dev/null | grep -i security | wc -l
# Erwartet: 0
# Fix:      unattended-upgrades installieren + aktivieren für auto-install
```

### ☐ Node.js auf supported Major-Version
```bash
node --version
# Erwartet: >= aktuelle LTS (z.B. v22.x zu diesem Zeitpunkt)
```

---

## 9. App-spezifisch (Payload / Next.js)

### ☐ `NODE_ENV=production`
```bash
grep -E "^NODE_ENV=" /opt/<app>/.env
# Erwartet: NODE_ENV=production
```

### ☐ `.next/` niemals in öffentlichem Pfad exposed
```bash
curl -sI https://<domain>/.next/BUILD_ID
# Erwartet: 404 oder 403, nicht 200
```

### ☐ `/admin` erreichbar nur bei gewollten Benutzern
Admin sollte hinter min. Password-Wall sein (Payload's eigene Auth reicht in
v1, später ggf. zusätzliche IP-Whitelist oder 2FA).

### ☐ Payload Access-Control: keine Collection accidentally public
```bash
grep -rn "access.*read.*=>.*true" src/collections/
# Erwartet: bewusst gesetzte public-read collections
# z.B. Media (öffentliche Bilder), Pages, Events, Work, Posts
# NICHT: Users, FormSubmissions
```

### ☐ Form-Submission rate-limit aktiv
In nginx:
```bash
grep -r "limit_req" /etc/nginx/sites-*/
# Erwartet: zumindest für /api/users/login und /api/form-submit
```

---

## 10. Monitoring & Logs

### ☐ PM2 autostart on boot
```bash
systemctl is-enabled pm2-<app-user>
# Erwartet: enabled
```

### ☐ Uptime check extern
Empfohlen: UptimeRobot / BetterUptime / Healthchecks.io — pingt `/` alle 5 min.
(In v1 oft noch nicht aktiv — notieren für Roadmap.)

### ☐ Error-Tracking / Logs
```bash
# PM2 logs rotieren?
ls /home/<app>/.pm2/logs/
# Erwartet: files < 100MB, log-rotate konfiguriert via pm2 install pm2-logrotate
```

### ☐ Failed-SSH-Attempts im normalen Rahmen
```bash
journalctl -u ssh --since today | grep -cE "Failed password|Invalid user"
# Erwartet: niedrig wenn fail2ban aktiv (<50), hoch ohne (>1000)
```

---

## 11. Pre-Launch-spezifisch

### ☐ Basic-Auth-Gate aktiv (während Entwicklung)
```bash
curl -sI https://<domain>/ | head -2
# Erwartet vor Go-Live: HTTP/2 401
# Erwartet nach Go-Live: HTTP/2 307/200
```

### ☐ `X-Robots-Tag: noindex` während Pre-Launch
```bash
curl -sI https://<domain>/ | grep -i x-robots
# Erwartet vor Go-Live: noindex, nofollow
# Nach Go-Live: header entfernt oder explizit erlauben
```

### ☐ Robots.txt / Sitemap.xml erreichbar
```bash
curl -s https://<domain>/robots.txt
curl -s https://<domain>/sitemap.xml | head -3
```

---

## 12. Domain & Redirects

### ☐ Canonical Domain + 301 für Alternativen
```bash
for d in www.<main> <alt1> www.<alt1>; do
  curl -sI https://$d/ | grep -iE "^(HTTP|location)"
done
# Erwartet: alle 301 auf https://<canonical>/
```

### ☐ Alle Domains auf richtige IP
```bash
for d in <main> www.<main> <alt> www.<alt>; do
  printf "%-30s → %s\n" "$d" "$(dig +short A "$d" @1.1.1.1 | head -1)"
done
```

### ☐ Cert deckt alle Domains ab
```bash
certbot certificates | grep -A1 "Certificate Name"
# Oder:
echo | openssl s_client -servername <domain> -connect <domain>:443 2>/dev/null | \
  openssl x509 -noout -ext subjectAltName
```

---

## Schnell-Ausführung (One-Shot)

Alle 12 Sektionen in einem einzigen SSH-Aufruf — nützlich für Quarterly Reviews.
Siehe `scripts/security-audit.sh` (bei Bedarf aus einer existierenden Boothside-
Session adaptieren — im Chat-Log unter "Full security audit" dokumentiert).

---

## Rote Flaggen — sofort handeln

Wenn einer dieser Punkte auftaucht, nicht warten, sondern heute fixen:

| Finding | Severity | Fix-Kommando |
|---|---|---|
| `.env` mit 644 oder world-readable | 🔴 Critical | `chmod 600 /opt/<app>/.env` |
| Default-Passwörter im Prod (`devpwd`, `changeme`) | 🔴 Critical | rotate + update `.env` + pm2 restart |
| DB-Port 5432 extern erreichbar | 🔴 Critical | postgres.conf `listen_addresses = 'localhost'` |
| `PasswordAuthentication yes` | 🟡 High | drop-in config + `systemctl reload ssh` |
| Kein Backup > 48h alt | 🟡 High | cron check + manual backup |
| Fail2ban nicht aktiv bei >1000 failed SSH/day | 🟡 Medium | apt install fail2ban + jail.local |
| Backup nur lokal, kein Off-Server | 🟡 Medium | S3-sync oder Volume-Snapshot konfigurieren |
| Admin-Zugang ohne 2FA (öffentlich) | 🟡 Medium | In v1 ok, für größere Sites 2FA-Integration |

---

## Audit-Log

Jeden Run dokumentieren in `docs/audit-<YYYY-MM-DD>.md`:

```markdown
# Audit YYYY-MM-DD

Ausgeführt von: <name>
Ausgeführt gegen: <hostname>/<domain>

## Findings
- [ ] ✅ .env permissions 600
- [ ] ✅ PAYLOAD_SECRET 64 chars
- [ ] 🟡 PasswordAuthentication war default → fixed
- [ ] 🟡 fail2ban installiert heute
- ...

## Actions taken
- Listed
- Out
- Here

## Follow-ups für nächsten Audit
- [ ] HSTS auf 31536000 + preload
- [ ] Off-Server-Backup konfigurieren
```
