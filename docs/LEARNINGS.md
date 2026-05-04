# Learnings & Patterns

Sammelstelle für Entscheidungen, Patterns und Bug-Hintergründe, die sich beim Aufbau der abgeleiteten Projekte bewährt haben. Primär aus dem `boothside`-Projekt konsolidiert, ergänzt durch Erfahrungen aus `ludwigmoeller` und `hugenottenhaus` (siehe [PROJECTS.md](PROJECTS.md)).

**Benutzung:**
- Suchst du einen konkreten Bug? → [KNOWN-ISSUES.md](KNOWN-ISSUES.md) (Quick-Lookup)
- Willst du die Background-Story / das *Warum*? → hier drin
- Setup eines neuen Projekts? → [NEW-PROJECT.md](NEW-PROJECT.md)
- Deployment? → [DEPLOYMENT.md](DEPLOYMENT.md)

**Kategorien:**
1. [Architektur-Entscheidungen](#1-architektur-entscheidungen)
2. [Payload-CMS-Gotchas](#2-payload-cms-gotchas)
3. [i18n / Lokalisierung](#3-i18n--lokalisierung)
4. [Performance / Caching](#4-performance--caching)
5. [Security](#5-security)
6. [DevOps / Deployment](#6-devops--deployment)
7. [Editor-UX-Patterns](#7-editor-ux-patterns)
8. [Content-vs-Layout-Trennung](#8-content-vs-layout-trennung)
9. [Bugs, die sich wiederholen können](#9-bugs-die-sich-wiederholen-können)
10. [Template-Kandidaten](#10-template-kandidaten)

> Projekt-spezifische Eigenheiten (Domains, IPs, Vault-Namen, Brand-Tokens) stehen am Ende im [Anhang: Projekt-Spezifika](#anhang-projekt-spezifika) — die nicht ins Template übernehmen.

---

## 1. Architektur-Entscheidungen

### Direct-Deploy statt Docker
Auf single-Server-Setups (Hetzner CX22, 2 GB RAM) läuft Next.js direkt über
PM2 mit systemd-autostart. Kein Docker, weil:
- Nur eine VM, keine Orchestrierung
- Payload schreibt Media lokal → Volume-Mounts wären fragil
- ~300 MB RAM-Overhead vermieden
- Debugging direkt über `pm2 logs` / `journalctl` ohne Container-Layer

**Wann Docker sich lohnt**: Multi-Server, S3-Media, CI/CD mit Registry.

### Reverse-Proxy-Architektur
```
Browser → nginx (SSL, cache, gzip, basic auth gate)
            ↓
         Next.js (port 3000, pm2-managed)
            ↓
         Postgres (localhost:5432, localhost-only)
```

`nginx` macht das schwere Heben:
- SSL-Termination (Let's Encrypt via certbot)
- gzip compression
- HTTP/2
- Static-asset long-cache (`/fonts`, `/_next/static`)
- **Image-Optimizer-Cache** (siehe Performance-Kapitel)
- Rate-Limiting auf Login-Endpoint
- Security Headers (HSTS, X-Frame, Referrer-Policy, etc.)

### Canonical Domain + 301-Redirects
Bei Mehrfach-Domains (`.com` + `.de` + `www.*` + Staging) **eine Canonical
wählen**, alle anderen per 301 mit Path-Preservation (`$request_uri`) umleiten.
Nie gleichen Content auf mehreren Domains — Duplicate-Content-Penalty.

```nginx
server {
    listen 443 ssl http2;
    server_name www.boothside.com boothside.de www.boothside.de;
    return 301 https://boothside.com$request_uri;
}
```

### Archive-Pages-Pattern für Index-Routen
Index-Routen wie `/work`, `/blog`, `/trade-shows` werden von dedizierten
Next.js-Routes gerendert (`app/[locale]/work/page.tsx`). Damit Editoren sie
trotzdem per Dropdown im Admin als Link-Ziel auswählen können, existieren in
der `pages`-Collection Platzhalter-Docs mit `isArchive: true`.

- **Schema**: `pages` hat ein `isArchive` boolean field.
- **Catch-all-Route** `[slug]/page.tsx` filtert `isArchive: true` in
  `generateStaticParams` UND in `DynamicPage` (→ 404, damit die Dedicated Route
  dominiert).
- **Nav-Seed**: alle Items referenzieren interne Pages (auch Archive-Pages).
- **Resultat**: Editor picked "Work" aus dem Dropdown, SmartLink resolvet zu
  `/{locale}/work`, und Next.js rendert die dedicated Index-Route.

---

## 2. Payload-CMS-Gotchas

### Das Localized-Array-Quirk (der wichtigste!)

**Bug**: Wenn man ein Array-Feld mit `localized: true` sub-fields via
`p.update({ locale: 'de', data: { layout: [...] } })` OHNE Item-IDs schickt,
**ersetzt Payload das komplette Array** — die EN-Werte gehen dabei verloren.

Das betrifft alle Block-Arrays (`layout`), aber auch verschachtelte Arrays wie
`m4-phase-split.phases[].features[]` oder `m15-packages-configurator.video.specs[]`.

**Fix-Pattern**: Fetch-existing-then-merge-with-IDs. Rekursiv.

```typescript
function mergeItems<T extends { id?: string }>(
  existing: T[] | undefined,
  deItems: Array<Partial<T>> | undefined,
): T[] {
  if (!existing) return []
  return existing.map((existingItem, i) => {
    const deItem = (deItems?.[i] ?? {}) as any
    const result: any = { ...existingItem, ...deItem, id: (existingItem as any).id }
    // Recurse into nested arrays of objects
    for (const key of Object.keys(result)) {
      const ev = (existingItem as any)?.[key]
      const dv = deItem[key]
      if (Array.isArray(ev) && Array.isArray(dv) && typeof ev[0] === 'object') {
        result[key] = mergeItems(ev, dv)
      }
    }
    return result as T
  })
}
```

**Beispiel-Workflow**:
```typescript
const existing = await p.find({ collection: 'pages', where: { slug: { equals: 'home' } }, locale: 'en' })
const mergedLayout = mergeLayout(existing.docs[0].layout, deLayoutOverrides)
await p.update({ collection: 'pages', id, locale: 'de', data: { layout: mergedLayout } })
```

### `allBlocks` / `detailBlocks` / `blogBlocks`
Wenn mehrere Collections unterschiedliche Block-Listen haben (`Pages` vs
`Events` vs `Posts`), **können Blocks silent gedropt werden** wenn sie im Seed
für eine Collection verwendet werden, die diesen Block nicht kennt.

Konkret: `m14-prose` war nur in `detailBlocks` + `blogBlocks`, nicht in
`allBlocks`. Beim Seeden einer Page mit m14-prose landete der Block nicht in
der DB — keine Fehlermeldung, einfach silent weg. Fix: `Prose` auch in
`allBlocks` aufnehmen, plus Migration für die neuen block-Tabellen.

**Lesson**: Wenn ein Block-Type in mehreren Collections verfügbar sein soll,
muss er in JEDER Block-Liste stehen. Am sichersten: eine zentrale
`const allBlocks` exportieren und per-Collection mit `.filter` sub-setten
statt komplette Listen neu zu definieren.

### plugin-seo vs. custom seoFields — nicht beides
Payloads offizielles `@payloadcms/plugin-seo` generiert automatisch einen
"SEO"-Tab mit `meta.title` / `meta.description` / `meta.image`. Wenn man
ZUSÄTZLICH ein custom `seoFields`-Group-Field anhängt, bekommt man einen
**doppelten SEO-Tab** im Admin + doppelte Spalten in der DB (`seo_meta_*`
UND `meta_*`).

**Entscheidung**: Nur das Plugin nutzen, `generateTitle` + `generateDescription`
callbacks im plugin-Setup definieren:

```typescript
seoPlugin({
  collections: ['pages', 'events', 'work', 'posts'],
  uploadsCollection: 'media',
  generateTitle: ({ doc }) => doc?.title ? `${doc.title} — Boothside` : 'Boothside',
  generateDescription: ({ doc }) => doc?.excerpt || doc?.shortIntro || '',
})
```

Im Frontend das plugin-Schema verwenden: `doc.meta?.title`, `doc.meta?.description`,
`doc.meta?.image`. **NICHT** `doc.seo?.metaTitle`.

### `useAsTitle` + `listSearchableFields` bei Upload-Collections
Die **Media-Search-Crash** hatte zwei Ursachen:
1. `useAsTitle` fehlte → admin-UI fiel auf `id` (UUID) zurück, was bei
   Relationship-Pickern zu undefined-Zugriffen führt.
2. `listSearchableFields: ['filename', 'alt', 'folder']` enthielt `folder`
   (select-Typ, enum in Postgres). Search feuert ILIKE gegen enum → Postgres
   error → blank right panel.

**Fix**: Nur Text-like Fields in `listSearchableFields`, und `useAsTitle` auf
`filename` (immer vorhanden bei Uploads).

```typescript
admin: {
  useAsTitle: 'filename',
  defaultColumns: ['filename', 'folder', 'alt', 'updatedAt'],
  listSearchableFields: ['filename'],
}
```

### Schema-Änderungen brauchen Migrations (auf Prod, nicht Dev)
In Dev pusht Payload Schema-Changes automatisch. In Prod mit
`@payloadcms/db-postgres` + `migrations`-Setup muss man:

```bash
pnpm payload migrate:create <name>   # generiert DIFF-SQL
pnpm payload migrate                 # applied es
```

`migrate:create` ist **interaktiv** wenn Payload die Intention nicht eindeutig
erkennt (z.B. "is this column renamed or newly created?"). Für automatisierten
Deploy: `expect` verwenden.

```bash
expect -c '
  set timeout 180
  spawn pnpm payload migrate:create batch_v2
  expect {
    -re {created or renamed} { send "\r"; exp_continue }
    eof
  }
'
```

### Globals `locale` + existing-items-IDs
Das gleiche Localized-Array-Problem gilt auch für Globals (Navigation, Footer,
CookieConsent). Fix-Pattern identisch: erst `findGlobal` ohne locale holen
(ID-Werte), dann DE-Items mit `{ id: existingItem.id, link: {...DE...} }`
übergeben.

### Payload-ID vs Slug
**Pitfall**: Wenn ein URL-Parameter (z.B. `?pkg=starter`) gegen `doc.id`
verglichen wird, matcht das nie — Payload-IDs sind Integer (`1`, `2`, `3`),
URL-Parameter sind meist Slugs (`starter`, `story`, `day`).

**Fix**: Tier-Type erweitern um `slug`, dann gegen `t.slug || String(t.id)`
vergleichen. Dort wo man einen "user-facing Identifier" braucht, immer den
Slug als Source-of-Truth nehmen.

### Access Control für API
Globale CMS-Reads sind standardmäßig auf `authenticated` geblockt. Wenn
Frontend-Components via direkter REST-API (`fetch('/api/...')`) zugreifen,
429/401 nicht public. Workaround:
- In-App via `payload()` SDK (Server-Component direkt, umgeht Access Control)
- Oder: `access: { read: () => true }` auf der Collection/dem Global setzen
  wenn's wirklich public sein soll (z.B. CookieConsent, SiteSettings).

### Block-Admin-Customization: `Label`, nicht `RowLabel`
Die Payload-API unterscheidet zwei Konzepte:

| Field-Typ | Admin-Component-Key | Zweck |
|---|---|---|
| `type: 'array'` | `admin.components.RowLabel` | Label im Array-Item-Header |
| `type: 'blocks'` (jeder einzelne Block) | `admin.components.Label` | Label im Block-Header |

TypeScript hilft hier wenig — `RowLabel` auf einem Block-Type gibt einen
`TS2353 Object literal may only specify known properties`-Error. Wichtig
auseinanderzuhalten.

**Trick**: der `useRowLabel`-Hook aus `@payloadcms/ui` funktioniert trotz
des Namens auch für Block-Label-Components. Der Name ist irreführend, das
zugrundeliegende Context-System ist das gleiche:

```tsx
'use client'
import { useRowLabel } from '@payloadcms/ui'

export function BlockRowLabel() {
  const { data, rowNumber } = useRowLabel<{
    blockType?: string
    title?: string
    wrapper?: { hidden?: boolean }
  }>()
  // data.wrapper.hidden gibt's, blockType ist verfügbar, etc.
}
```

### Custom-Admin-Components → `importMap` regenerieren
Jedes Mal wenn eine neue Custom-Component ins Schema eingehängt wird
(`@/admin/...` Pfad in einem Block-/Field-Config), muss:

```bash
pnpm generate:importmap
```

Das scannt die Payload-Config, findet alle `PayloadComponent`-Referenzen,
und schreibt sie ins `src/app/(payload)/admin/importMap.js`. Ohne diesen
Schritt kennt der Admin-Bundle den Pfad nicht und zeigt den Default-Label.

### Blocks mit `.map()` uniform konfigurieren
Wenn eine admin-Einstellung (Label-Component, Access-Control etc.) **alle**
Blocks betreffen soll, nicht in 22 Einzeldateien duplizieren, sondern
einen Wrapper bauen:

```typescript
function withRowLabel(block: Block): Block {
  return {
    ...block,
    admin: {
      ...block.admin,
      components: {
        ...block.admin?.components,
        Label: '@/admin/BlockRowLabel#BlockRowLabel',
      },
    },
  }
}

export const allBlocks = [Hero, Marquee, BentoWork, ...].map(withRowLabel)
```

Benefit: wenn später die Label-Component erweitert wird, greift's sofort auf
allen 22 Blocks. Neue Blocks bekommen's automatisch beim Hinzufügen zur
Liste.

---

## 3. i18n / Lokalisierung

### URL-Segmente schlagen Header-Detection
**Header-based** (via Accept-Language + `currentLocale()` auf `headers()`):
- Google indexiert nur Default-Locale
- hreflang nicht sauber möglich
- Next.js markiert alle consumer als **dynamic** → kein ISR
- Social-Shares landen in falscher Sprache

**URL-Segmente** (`/en/about`, `/de/about`):
- Beide Sprachen separat crawlbar
- hreflang via sitemap sauber mappbar
- Pages statisch generierbar (`generateStaticParams` für beide Locales)
- TTFB-Drop: **1.2 s → ~100 ms**

### Für echtes SSG: locale aus `params`, nicht aus `headers()`
Eine Function wie `currentLocale()` die intern `headers()` aufruft macht ALLE
Consumer dynamic — auch bei `export const revalidate = 60`. Für ISR/SSG
muss locale explizit als Prop durchgereicht werden:

```tsx
// Page
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const doc = await fetchPage('about', locale)
  return <RenderBlocks blocks={doc.layout} locale={locale} />
}

// Root layout passt locale an Header/Footer
<Header locale={locale} />
<RenderBlocks blocks={...} locale={locale} />

// RenderBlocks forwarded an jeden Block
return <Component key={i} {...block} locale={locale} />
```

Das macht jeden downstream-Component locale-aware ohne headers()-Zugriff.

### Middleware: Redirect + Header-Forwarding
```typescript
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasLocale = SUPPORTED.some((loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`))

  if (!hasLocale) {
    // Detect preferred locale, redirect
    const locale = detectLocale(req.cookies.get('pref-locale')?.value, req.headers.get('accept-language'))
    const url = req.nextUrl.clone()
    url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
    return NextResponse.redirect(url)
  }

  // Forward pathname as header so server components that STILL need locale
  // context (e.g. Payload livePreview) can read it without re-parsing URL.
  const headers = new Headers(req.headers)
  headers.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|admin|.*\\..*).*)'],
}
```

### SmartLink mit locale-prefix
Der zentrale Link-Resolver muss locale wissen:
```typescript
function resolveUrl(link: LinkData, locale: string): string | null {
  if (link.reference) {
    const doc = link.reference.value
    if (link.reference.relationTo === 'pages' && doc.slug === 'home') return `/${locale}`
    return `/${locale}${COLLECTION_PATHS[link.reference.relationTo]}${doc.slug}`
  }
  if (link.url) {
    if (link.url.startsWith('/') && !hasLocalePrefix(link.url)) return `/${locale}${link.url}`
    return link.url
  }
  return null
}
```

**SmartLink bekommt `locale` als Prop**, nicht aus `currentLocale()` — sonst
verliert man SSG (siehe oben).

### Sitemap mit hreflang alternates
```typescript
function pushLocalized(suffix: string, lastModified?: Date, priority?: number) {
  const alternates = Object.fromEntries(LOCALES.map((loc) => [loc, `${base}/${loc}/${suffix}`]))
  for (const loc of LOCALES) {
    urls.push({
      url: alternates[loc],
      lastModified,
      priority,
      alternates: { languages: alternates },
    })
  }
}
```

Ergebnis: Jede URL wird 2× in der Sitemap geschrieben (EN + DE), beide
Einträge verweisen per `<xhtml:link rel="alternate" hreflang="xx">` auf
die jeweils andere Sprache. Google versteht das nativ.

### LocaleSwitcher muss Pfad erhalten
```typescript
function setLocale(loc: Locale) {
  const withoutLocale = pathname.replace(/^\/(en|de)(?=\/|$)/, '')
  const newPath = withoutLocale === '' ? `/${loc}` : `/${loc}${withoutLocale}`
  document.cookie = `pref-locale=${loc}; Path=/; Max-Age=31536000; SameSite=Lax`
  router.push(newPath)
}
```

Cookie wird für Bare-Path-Redirects in der Middleware genutzt.

---

## 4. Performance / Caching

### Next.js Image Optimizer braucht einen persistent Cache
Default verhalten: Next.js cached in `.next/cache/images/`, aber das wird
beim Rebuild (und oft auch so) gerne leer. Ergebnis: **jeder Request triggert
Sharp-Processing → ~470 ms pro Variante**.

**Fix 1: nginx proxy_cache vor `/_next/image`**:
```nginx
proxy_cache_path /var/cache/nginx/images
                 levels=1:2
                 keys_zone=nextimg:100m
                 max_size=2g
                 inactive=30d
                 use_temp_path=off;

location /_next/image {
    auth_basic off;
    proxy_cache nextimg;
    proxy_cache_key "$scheme$host$request_uri";
    proxy_cache_valid 200 30d;
    proxy_cache_lock on;        # coalesce concurrent first-hits
    proxy_cache_revalidate on;
    proxy_pass http://127.0.0.1:3000;
    expires 30d;
    add_header X-Cache-Status $upstream_cache_status;
}
```

**Fix 2: `minimumCacheTTL`**: Next.js default ist 4 Stunden. Hochdrehen auf
30 Tage:
```typescript
images: {
  minimumCacheTTL: 2592000,
}
```

**Fix 3: `deviceSizes` reduzieren**: Default sind 8 Varianten
`[640, 750, 828, 1080, 1200, 1920, 2048, 3840]` — overkill für eine
Marketing-Site. Auf 3 reduzieren:
```typescript
deviceSizes: [640, 1080, 1920],
imageSizes: [256, 384, 640],
```

**Fix 4: Pre-Warm-Script nach Deploy**: Siehe `scripts/prewarm-images.sh` —
fetcht alle media docs × alle Varianten einmal durch, damit der erste echte
User-Request immer cached ist.

**Ergebnis**: von ~3-4 s LCP-Image auf ~100 ms cached.

### Deploy sollte `.next/cache` nicht löschen
```bash
# FALSCH (kills image cache)
rm -rf .next && pnpm build

# RICHTIG (keeps image cache + pnpm build-cache)
rm -rf .next/server .next/static .next/types \
       .next/build-manifest.json .next/app-build-manifest.json
pnpm build
```

### SSG via `generateStaticParams`
Jede Page unter `[locale]/` muss `{ locale }` via Parent-Layout generieren,
dynamische Slugs via own generateStaticParams.
Next.js kombiniert automatisch: `{ locale: 'en', slug: 'foo' }` × {de, en}.

```typescript
// app/(frontend)/[locale]/layout.tsx
export function generateStaticParams() {
  return ['en', 'de'].map((locale) => ({ locale }))
}

// app/(frontend)/[locale]/[slug]/page.tsx
export async function generateStaticParams() {
  try {
    const pages = await payload.find({ collection: 'pages', limit: 100 })
    return pages.docs
      .filter((p) => p.slug !== 'home' && !p.isArchive)
      .map((p) => ({ slug: p.slug }))
  } catch {
    return []  // DB unreachable at build (CI) → on-demand generation
  }
}
```

**Immer `try/catch`** in generateStaticParams — sonst bricht `pnpm build`
in CI-Environments ohne DB-Zugriff.

### Inline CSS + local Fonts
- `experimental.inlineCss: true` in next.config → kritisches CSS im `<style>`
  inline, spart einen render-blocking request
- Lokale Fonts via `next/font/local` → keine CDN-requests, DSGVO-safe,
  `preload` wird automatisch gesetzt

### Browserslist-Config für moderne Polyfills
Durch browserslist-Config in `package.json` kann man legacy-JS-Polyfills
(Array.prototype.at, Object.fromEntries, etc.) aus dem bundle sparen:
```json
"browserslist": {
  "production": [
    ">0.5%",
    "not dead",
    "Chrome >= 98",
    "Firefox >= 97",
    "Safari >= 15.4",
    "Edge >= 98"
  ]
}
```
**Achtung**: Mit Turbopack (Next.js 16 default) wird diese Config nicht immer
respektiert — offener Bug. Ggf. `--no-turbopack` für build.

### Image Quality
Für ein Foto/Video-Studio: `quality=80`. Lighthouse-Score minimal schlechter
als bei 65, aber Bilder sehen premium aus. Die Zielgruppe bewertet das Bild,
nicht den Score.

---

## 5. Security

### DB + Firewall
- Postgres lauscht nur auf `127.0.0.1` (nicht extern erreichbar)
- UFW: nur SSH/80/443 offen
- `scram-sha-256` für Password-Auth (nicht `md5`)
- `boothside_app` User ist kein Superuser (least privilege)

### Starkes Passwort + rotiert
Default war `devpwd` beim Bootstrap. Zu **28-Zeichen Random** gedreht,
in 1Password als Database-Item gespeichert. Beim Rotieren den Wert NIE im
Shell-Output echoen — direkt aus 1Password pipen:

```bash
NEW_PW=$(openssl rand -base64 30 | tr -d '=+/\n' | head -c 28)
op item create --category=database --title="..." password="$NEW_PW" ...
ssh server "sudo -u postgres psql -c \"ALTER USER app WITH PASSWORD '$NEW_PW';\""
ssh server "sed -i -E 's|^DATABASE_URL=.*|DATABASE_URL=...:$NEW_PW@...|' .env"
unset NEW_PW
```

### 1Password Item-Types
| Credential | Item-Type | Vault |
|---|---|---|
| PostgreSQL | **Database** (server/port/db/user/password) | `dev` |
| Basic Auth / App-Login | **Login** (URL + username + password) | `dev` |
| SSH-Server-Zugang | **Server** (hostname/port/user + Notes) | `dev` |
| `PAYLOAD_SECRET` | **Password** (only pw + notes) | `dev` |

**Trennung**: Tech-Zugänge → `dev`-Vault. Client-facing-Logins → `Kundendaten`.

### HTTP-Security-Headers
```nginx
add_header Strict-Transport-Security "max-age=604800; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

HSTS nach 4 Wochen problemlosen Betriebs auf `max-age=31536000; includeSubDomains; preload` hochdrehen + bei Google HSTS-Preload-Liste eintragen.

### SSH hardening — `PasswordAuthentication no` ist NICHT der Default

Ubuntu ships mit `PasswordAuthentication yes` per default. `PermitRootLogin prohibit-password` deaktiviert Passwort-Login nur für `root`, aber andere User können weiterhin per Passwort rein.

**Fix**: Eigene drop-in erstellen statt in `/etc/ssh/sshd_config` reinschreiben (damit certbot / Ubuntu-Upgrades die config nicht überschreiben):

```bash
cat > /etc/ssh/sshd_config.d/50-harden.conf <<EOF
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sshd -t && systemctl reload ssh
```

### `/etc/nginx/.htpasswd` nicht world-readable

Standard-Tutorials lassen das File auf `644 root:root` — **world-readable**. Das ist harmlos wenn nur root SSH-Zugriff hat, aber best-practice:

```bash
chown root:www-data /etc/nginx/.htpasswd
chmod 640 /etc/nginx/.htpasswd
```

Owner root (für Admin-Änderungen), group www-data (nginx user), world kann nichts.

### Fail2ban — SSH + nginx-http-auth jails

Nach dem Go-Live sahen wir 4722 failed SSH attempts pro Tag von Bot-Scans. Fail2ban dropped das auf <100 weil wiederholte Fails temporär gebannt werden.

```bash
apt-get install -y fail2ban
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
backend = systemd
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5
EOF
systemctl enable --now fail2ban
fail2ban-client reload  # falls jails nach erstem start fehlen
```

**Prüfen**: `fail2ban-client status` → zeigt "Number of jail: 2" mit `sshd` und `nginx-http-auth`. Falls nur 1 jail aufgeführt ist, `fail2ban-client reload` nötig.

### Audit-Methodik

Nach jedem neuen Projekt (oder vor Go-Live) komplette Audit-Checkliste durchgehen. Siehe `docs/SECURITY-AUDIT-checklist.md` für das vollständige Template.

### Rate-Limiting auf Admin-Login
```nginx
limit_req_zone $binary_remote_addr zone=admin_login:10m rate=10r/m;

location /api/users/login {
    limit_req zone=admin_login burst=5 nodelay;
    limit_req_status 429;
    ...
}
```

### Pre-Launch-Gate: Basic Auth
Während Entwicklung + Review: Basic Auth auf `/` aber **nicht auf `/api/*`**
(sonst bricht das Kontaktformular). Plus `X-Robots-Tag: noindex, nofollow`
damit Google's crawler die gated site nicht indexiert.

### Backups
Tägliches `pg_dump` über Cron in `/var/backups/postgresql/`, 14 Tage
Retention. Script als Symlink in `/etc/cron.daily/`. Additional: Hetzner's
eigene Volume-Snapshots (separater Layer).

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DB_NAME="boothside"
KEEP_DAYS=14
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
sudo -u postgres pg_dump --no-owner --no-acl "$DB_NAME" | gzip -9 > "$TARGET"
chmod 600 "$TARGET"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +${KEEP_DAYS} -delete
```

---

## 6. DevOps / Deployment

### Deploy-Flow
```bash
# 1. Sync files (tar + ssh ist schneller als rsync bei vielen kleinen Files)
tar cz src/... public/... | ssh server 'cd /opt/app && tar xz'

# 2. Migration erstellen (falls Schema-Änderungen)
ssh server "cd /opt/app && expect -c '
  spawn pnpm payload migrate:create <name>
  expect { -re {created or renamed} { send \"\r\"; exp_continue } eof }
'"

# 3. Migration apply
ssh server 'cd /opt/app && pnpm payload migrate'

# 4. Build (Cache-preserving)
ssh server 'cd /opt/app && rm -rf .next/server .next/static .next/types .next/build-manifest.json .next/app-build-manifest.json && pnpm build'

# 5. Restart
ssh server 'sudo -u app pm2 restart app'

# 6. Pre-warm Images
ssh server 'cd /opt/app && pnpm prewarm'

# 7. Reseed (nur wenn Content-Change — nicht für normale Deploys!)
ssh server 'cd /opt/app && ALLOW_SEED=true pnpm seed'
```

### PM2 als systemd service
```bash
pm2 startup systemd -u app --hp /home/app
pm2 save   # nach letzter Änderung
```

### Interaktive migrate:create automatisieren
Mit `expect` lässt sich der interaktive Prompt umgehen:
```bash
apt-get install -y expect
expect -c '
  set timeout 180
  spawn pnpm payload migrate:create batch_v2
  expect {
    -re {created or renamed} { send "\r"; exp_continue }
    eof
  }
'
```

ENTER = default = "create column" (nicht rename). Bei bewussten Renames:
eigene Regex + send line wie `send "\x1b\[B\r"` für Arrow-Down.

### SSH-Keys ohne Passphrase
Beim Setup war der Key Passphrase-geschützt → Non-interactive SSH failed.
Fix: `ssh-add ~/.ssh/id_ed25519` lokal beim User, oder Key ohne Passphrase
(für CI-Accounts).

### 1Password SSH-Agent statt OpenSSH-Agent
Wenn der User 1Password mit SSH-Agent-Integration nutzt, muss
`SSH_AUTH_SOCK` explizit auf 1Password's socket gesetzt werden, sonst greift
der Standard macOS-Launchd-Agent (der den key nicht hat):

```bash
export SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
ssh boothside 'uname -a'   # 1Password promptet jetzt einmal für Approval
```

Die SSH-Config sollte den Host-Alias verwenden damit `IdentityFile` in
`~/.ssh/config` greift:

```
# ~/.ssh/config
Host boothside
  HostName 178.104.236.224
  User root
  IdentityFile ~/.ssh/boothside-prod.pub
```

Der `IdentityFile` pfad ist der **Public Key** (nicht private) — 1Password
hält den privaten Teil intern. OpenSSH nutzt den Public key zum Matching und
delegiert Signing an 1Password.

### Never commit .env
Production-Secrets (DATABASE_URL, PAYLOAD_SECRET) ausschließlich
server-lokal in `.env`. Niemals in Git. Sandbox sollte `.env`-Reads
für `pwd`-Zugriffe blocken (Ja, wir haben das tatsächlich gesehen —
das ist richtig so).

---

## 7. Editor-UX-Patterns

### SmartLink mit Dropdown, nicht URL-Text
linkField gibt Editoren einen Radio-Switch "Intern / Extern":
- **Intern** → Relationship-Dropdown (Pages/Events/Work/Posts)
- **Extern** → URL-Textfeld + "Open in new tab" checkbox

**Regel**: im SEED IMMER mit `type: 'internal'` + `reference` arbeiten wenn
die Ziel-Page/Doc existiert. Niemals external-mit-relativem-Pfad als
vermeintlich interner Link. Sonst sieht der Editor später einen
URL-Textfeld und tippt fehleranfällig die URL.

### Admin-Groups für Ordnung
```typescript
admin: {
  group: 'Content',  // oder: 'Settings', 'Media', 'Taxonomy'
}
```

Payload gruppiert die Sidebar — hilft bei 10+ Collections.

### Tabs in Globals für Overload
Wenn ein Global 15+ Felder hat (wie CookieConsent), ist ein Tab-Layout viel
angenehmer:
```typescript
fields: [
  {
    type: 'tabs',
    tabs: [
      { label: 'Banner-Text', fields: [...] },
      { label: 'Buttons', fields: [...] },
      { label: 'Kategorien', fields: [...] },
    ],
  },
]
```

### Helper-Descriptions im Admin
Jedes nicht-triviale Field bekommt `admin.description`. Besonders bei
Feldern, deren Bedeutung sich aus dem Namen nicht ergibt:
```typescript
{
  name: 'isArchive',
  type: 'checkbox',
  admin: {
    description: 'Markiert diese Page als Platzhalter für eine Collection-Index-Route (/work, /blog). Wird nicht eigenständig gerendert — die Next.js-Route übernimmt.',
  },
}
```

### useAsTitle + defaultColumns
Jede Collection sollte `useAsTitle` setzen UND `defaultColumns` — das ist
die erste Info, die der Editor bei Listen-Views sieht.

### Editor-sichtbare Trennung: Content vs Settings
Collections, die täglich von Editoren angefasst werden (Pages, Events, Work,
Posts, FAQs) gehen in `admin.group: 'Content'`. Verwaltungs-Zeug (Media,
Package-Tiers, Categories, Tags, FormSubmissions) geht in `'Settings'` oder
`'Taxonomy'`.

### Block ausblenden statt löschen
**Problem**: Editor möchte eine Section temporär deaktivieren (z.B. Sale-Banner
außerhalb der Saison), aber Löschen = Content weg.

**Lösung — generic via `wrapper.hidden` field**:
1. `makeWrapperFields()` bekommt eine `hidden: boolean`-Checkbox als erstes Feld
2. Jedes Block das `makeWrapperFields()` nutzt kriegt's automatisch
3. `RenderBlocks.tsx` filtert alle Blocks mit `wrapper.hidden === true`
4. Admin-Header zeigt visuellen Status via custom Label-Component:
   `🚫 Ausgeblendet: <BlockType> — <Summary>` in italic + opacity 0.55

**Wo der Toggle lebt**: im normalen Block-Form, erste Zeile der Wrapper-Gruppe.
Der Editor öffnet den Block → klickt Checkbox → spart direkt. Im collapsed
Header sieht er sofort, dass der Block aus ist (auch ohne Öffnen).

**Ideal-UX wäre im 3-Dot-Menü** (Duplicate/Delete sitzen dort). Payload v3
lässt diese Actions aber nicht erweitern ohne Custom-Admin-React-Hacks. Der
Header-Label-Ansatz kommt dem visuellen Nutzen nah — 90% der UX-Qualität
für 10% des Aufwands.

**Migration**: 1 × `pnpm payload migrate:create add_block_hidden_toggle`
erzeugt die `wrapper_hidden`-Spalte auf ALLEN Block-Tables (Pages, Events,
Work, Posts × 22 Block-Typen = 40+ Tabellen simultan).

---

## 8. Content-vs-Layout-Trennung

**Die wichtigste Lesson aus dem Boothside-Projekt**: Layout-Parameter
(gridCols, gridRows, aspect-ratios, spacing) gehören **ins Modul-Component**,
nicht ins Content-Feld.

### Warum?
1. Editor muss nicht verstehen, was "gridCols: 7, gridRows: 4" bedeutet
2. DE-Translation-Seeds brauchen Layout-Values nicht zu kennen (und können
   sie nicht mit alten Werten überschreiben)
3. Designer legt Layout einmal fest, Markus befüllt nur Content
4. Konsistenz über alle Instanzen des Moduls

### Pattern: fixed-position layout
```typescript
// Im Component
const LAYOUT: { cols: number; rows: number }[] = [
  { cols: 7, rows: 4 },  // 0: Hero
  { cols: 5, rows: 3 },  // 1: Right-top
  { cols: 5, rows: 1 },  // 2: Accent slot
  { cols: 4, rows: 2 },  // 3
  // ...
]

export function BentoWork({ items }: Props) {
  return (
    <div className="grid grid-cols-12 grid-flow-dense auto-rows-[minmax(230px,auto)]">
      {items.slice(0, LAYOUT.length).map((item, i) => {
        const spec = LAYOUT[i]
        return item.isAccent
          ? <AccentCell item={item} className={span(spec.cols, spec.rows)} />
          : <MediaCell item={item} className={span(spec.cols, spec.rows)} />
      })}
    </div>
  )
}
```

### Block-Schema: nur Content
```typescript
{
  name: 'items',
  type: 'array',
  maxRows: 9,
  admin: { description: 'Position 3 ist der Accent-Slot. Max. 9 Items.' },
  fields: [
    { name: 'isAccent', type: 'checkbox' },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'image', type: 'upload', relationTo: 'media', admin: { condition: (_, sib) => !sib?.isAccent } },
    // ... andere Content-Felder — KEINE gridCols/gridRows
  ],
}
```

### Seed: nur Content
```typescript
items: [
  { title: 'BIOFACH 2026', image: img('boothWide') },
  { title: 'SPS Interview', image: img('interview') },
  { isAccent: true, title: 'Archive', accentNum: '200+', accentCta: {...} },
  // ...
]
```

Weniger Zeilen, klarer Scope, keine "magischen Werte" die sich gegenseitig
überschreiben können.

### Wann doch konfigurierbar?
Wenn der Editor **wirklich** die Kontrolle brauchen soll (z.B. Bilder-Galerie
mit 1/2/3/4 Spalten je nach Inhalt). Dann lieber ein `layout: select`-Field
mit vorgefertigten Templates statt granularer cols/rows.

---

## 9. Bugs, die sich wiederholen können

Checkliste für zukünftige Projekte — diese Fehler haben uns Zeit gekostet:

### ☐ CSS-Klassen, die nicht im Theme existieren
Cookie Banner hatte `bg-warm-white`, `text-deep-black`, `text-warm-gray` aus
einem älteren Theme. Tailwind kompiliert sie nicht → Buttons transparent.
**Check**: Beim Template-Einbau alle CSS-Klassen gegen das aktuelle Theme
abgleichen. `grep -rln 'warm-white\|deep-black'` nach dem Theme-Swap.

### ☐ Turbopack-Polyfills trotz modernem browserslist
13 KiB Legacy-JS im Bundle trotz Chrome>=98-Config. Known-Issue.

### ☐ Object-Spread bei Partial-Updates
`{...existing, ...partial}` bringt **explizit undefined-Werte** vom partial
mit und überschreibt existing. Immer: `id: existingItem.id` explizit am Ende
respread.

### ☐ Client-Component in Server-Component gemountet, braucht `<Suspense>`
Wenn der Client-Component `useSearchParams()` aufruft, braucht er einen
`<Suspense>` Wrapper — sonst bricht der Build bei SSG.

### ☐ Direkter HTTP-Anfrage bei `x-nextjs-cache: MISS`
Wenn Next.js Image Optimizer konstant `MISS` zurückgibt, ist der persistent
Cache kaputt. Nie auf Next.js built-in Cache alleine verlassen → nginx
dazwischen.

### ☐ Next.js "route handlers" (API routes) auch beim Deploy warmen
Ähnlich wie Images: erste API-Aufrufe nach Deploy sind cold. Für kritische
Endpoints ggf. separates Pre-Warm.

### ☐ Payload localization "fallback: true" gibt EN zurück
Wenn ein DE-Feld leer ist, bekommt man EN zurück — nicht leer. Kann Bugs
verschleiern, wo man denkt "sieht ja übersetzt aus" und die DE-Spalte ist in
Wahrheit leer. **Immer DB direkt prüfen**:
```sql
SELECT _locale, col FROM table_locales ORDER BY _locale LIMIT 8;
```

### ☐ Migration-Prompts blockieren CI-Deploys
`pnpm payload migrate:create` ist interaktiv. Für nicht-TTY-Environments:
`expect` oder manuelle Migration schreiben.

### ☐ Missing `useAsTitle` bei Upload-Collections
Führt zu diffusen Admin-UI-Bugs (List-View crashes, blank panels). Immer
setzen.

### ☐ Domain-Cutover + Basic Auth + `/_next/image`
Wenn man Basic Auth auf `/` setzt, müssen `/api/*` UND `/_next/image` via
`auth_basic off;` ausgenommen sein — sonst laden keine Bilder und kein
Formular funktioniert.

### ☐ ISR-Cache stale nach DB-Changes
PM2-Restart allein clearet nicht den `.next/cache/fetch-cache`. Für
Revalidate-Before-60s: entweder warten, oder `revalidatePath()` API-Call,
oder `.next/cache/fetch-cache` löschen.

### ☐ `grid-auto-flow: row` skippt Löcher
CSS Grid mit mixed-size items (manche Rows=4, manche Rows=1) hat Löcher in
der Grid-Struktur. Default row-flow ist forward-only und skippt Löcher.
`grid-flow-dense` erlaubt Back-Fill.

### ☐ `expect` in SSH-stdin-Pipes failt silent
Wenn ein `expect`-Command als Teil einer kombinierten Pipe ausgeführt wird
(`tar … | ssh … 'expect -c … && pnpm build …'`), kann `expect` manchmal
den spawned Process nicht richtig attachen — läuft ohne Output, erzeugt
keine Migration, "Done"-Message kommt aber trotzdem.

**Fix**: `expect`-Calls isoliert ausführen (eigener SSH-Call), nicht in der
Pipeline mit anderen Commands verkettet:

```bash
# SCHLECHT (flakey)
tar cz ... | ssh host '... && expect -c "..." && pnpm build'

# GUT
tar cz ... | ssh host 'cd /opt/app && tar xz'
ssh host "cd /opt/app && expect -c '...'"
ssh host 'cd /opt/app && pnpm payload migrate && pnpm build'
```

### ☐ `RowLabel` vs `Label` für Blocks
TypeScript verweigert `admin.components.RowLabel` auf `Block`-Types mit
"property does not exist". Blocks haben `Label`, nur `type: 'array'`-Fields
haben `RowLabel`. Der `useRowLabel`-Hook funktioniert trotzdem in beiden
(misleading name).

### ☐ importMap vergessen nach Custom-Component
Wenn ein Custom-Admin-Component via `@/admin/...` Pfad referenziert wird
aber `pnpm generate:importmap` nicht lief, zeigt der Admin den Default-Label
statt des custom Components. Stumm, kein Error — einfach kein Effekt.
**Routine**: nach jeder Schema-Änderung die Admin-Components einführt,
`pnpm generate:importmap` vor dem Build laufen lassen.

### ☐ React 19: fetchPriority ist camelCase in JSX, lowercase im HTML
Der Browser handlet beide case-insensitive, aber statische HTML-Grep-Checks
(`grep fetchpriority=`) matchen nicht. Suche nach `fetchPriority` (gemischt)
oder case-insensitive mit `-i`.

---

## 10. Template-Kandidaten

Was von Boothside gut in ein Payload-CMS-Template passt:

### Infrastruktur / Files
- [x] `scripts/prewarm-images.sh` — universal nach kleiner Anpassung
- [x] `scripts/seed-legal-pages.ts` (optional; Impressum/Privacy/Terms)
- [x] Backup-Cron: `/usr/local/bin/app-db-backup` generisch mit DB-Name als Param
- [x] nginx-Config-Template mit: HTTP/2, gzip, image-cache, security-headers, rate-limit, basic-auth-optional-Block
- [x] Deploy-Flow-Doku / Script

### Code-Patterns
- [x] `linkField()` (bereits im Template)
- [x] `SmartLink` mit locale-prefix
- [x] `BlockWrapper` (bereits im Template)
- [x] `buildPageMetadata` helper für plugin-seo
- [x] Middleware mit locale-redirect + pathname-forwarding
- [x] `currentLocale()` als fallback-helper, aber Primary-Pattern: locale aus params
- [x] RenderBlocks mit locale-prop-forwarding + `wrapper.hidden`-Filter
- [x] `mergeItems` / `mergeBlock` / `mergeLayout` helper für locale-overlays
- [x] Archive-Page-Pattern (`isArchive: true`)
- [x] `wrapper.hidden`-Toggle für Block-Ausblenden (via `makeWrapperFields`)
- [x] `BlockRowLabel.tsx` Custom-Label-Component (zeigt hidden-State im Admin)
- [x] `withRowLabel()` `.map()`-Helper um Label-Component uniform auf alle Blocks anzuwenden

### Conventions
- [x] Folder-Struktur: `src/app/(frontend)/[locale]/*`
- [x] Locale-List + defaultLocale in config zentral
- [x] `admin.group` für Collection-Sidebar-Ordnung
- [x] `useAsTitle` + `defaultColumns` auf jeder Collection
- [x] Seed-Helper-Trennung: per-Collection + `seed.ts` als Orchestrator
- [x] EN-Seed + DE-Overlay-Pattern via `p.update({ locale: 'de' })`
- [x] Blocks in Content ohne Layout-Parameter — Layout im Component

### Schema-Snippets
- [x] CookieConsent global (EN + DE defaults + 4 Kategorien-Tabs)
- [x] SEO-Plugin-Setup mit generateTitle/generateDescription callbacks
- [x] Media-Collection mit useAsTitle + restricted listSearchableFields

### CLI / Package-Scripts
```json
{
  "seed": "tsx --env-file=.env src/seed.ts",
  "prewarm": "./scripts/prewarm-images.sh",
  "db:drop": "psql '...' -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'",
  "db:reset": "lsof -ti:3001 | xargs -r kill; sleep 1 && pnpm db:drop && ALLOW_SEED=true pnpm seed"
}
```

### Environment-Template
```
DATABASE_URL=postgres://user:pass@localhost:5432/db
PAYLOAD_SECRET=<32-byte hex from `openssl rand -hex 32`>
NEXT_PUBLIC_SITE_URL=https://example.com
# Optional:
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@example.com
```

### CLAUDE.md-Ergänzungen
- Localized-Array-Quirk als Pattern-Section
- Archive-Page-Pattern
- Content-vs-Layout-Regel
- Deploy-Command mit Cache-preserving

---

## 11. Boothside 2026 — Neue Erkenntnisse

Aus der Boothside-Session Mai 2026 (Next.js 16, Postgres, Bunny CDN). Diese
Punkte sind durch echte Prod-Incidents oder Lighthouse-Iterationen entstanden.

### 11.1 Next.js 16: Webpack pinnen (Turbopack-Prod ist instabil)

`next build` defaultet seit Next 16 auf Turbopack. Production-Build-Turbopack
generiert intermittent **`pages-manifest.json` nicht**, meldet aber
"Compiled successfully". Der Server crasht dann erst bei Runtime mit
`InvariantError: Could not find pages manifest`. Hat Boothside einmal
runtergenommen.

Fix im Template: `package.json` build-Script enthält `--webpack`.

```json
"build": "cross-env NODE_OPTIONS=\"--no-deprecation --max-old-space-size=8000\" next build --webpack"
```

Webpack-Build dauert ~15s länger pro Deploy, ist aber reproduzierbar.
**Re-Evaluierung**: Next 17 GA + 3 Monate Community-Stabilität abwarten.

### 11.2 `overflow-x: clip` (nicht `hidden`) auf html, body

Klassische "no horizontal scroll"-Direktive ist `overflow-x: hidden` — die
**bricht aber `position: sticky` in jedem Descendant**. Grund: `overflow:
hidden` erzeugt einen scroll-containing-block; sticky braucht aber den
nächsten scrollenden Ancestor.

`overflow-x: clip` ergibt visuell dasselbe (kein Horizontal-Scroll), erzeugt
aber **keinen** containing-block → sticky funktioniert weiter.

```css
html, body {
  overflow-x: clip;  /* nicht: hidden */
}
```

Beide brauchen es (html UND body) — iOS Safari ignoriert body-only.
Browser-Support: Chrome 90+, Safari 16+, Firefox 81+ → unbedenklich 2026.

### 11.3 `100dvh` statt `100vh` für Full-Viewport-Overlays

iOS Safaris einklappende Toolbar lässt `100vh` über den sichtbaren Bereich
hinausschiessen. Mobile-Menüs / Modals → `height: 100dvh` benutzen, dann
sitzen sie sauber im sichtbaren Viewport.

Im Template: `MobileMenu.tsx` deckt mit `top: 0; height: 100dvh` den
gesamten sichtbaren Viewport ab — und braucht deshalb einen In-Overlay-
Close-Button (der Header mit dessen Close-Button liegt unter dem Overlay).

### 11.4 `position: fixed` Containing-Block-Falle

Jeder Ancestor mit `transform`, `filter`, `perspective`, oder `will-change`
verwandelt `position: fixed` in `position: absolute` relativ zu diesem
Ancestor. Symptom: "Mobile-Menu / Modal sitzt nach Scroll an der falschen
Stelle." Lösung: per `createPortal(element, document.body)` aus dem
Stacking-Kontext rausspielen — siehe `MobileMenu.tsx`.

### 11.5 Sharp `imageSizes`: aspect-preserving Varianten ergänzen

```ts
imageSizes: [
  { name: 'thumbnail', width: 400,  height: 300, position: 'centre' },  // cropped
  { name: 'card',      width: 768,  height: 576, position: 'centre' },  // cropped
  { name: 'small-w',   width: 800,  height: undefined, position: 'centre' },  // ASPECT-PRESERVING
  { name: 'medium-w',  width: 1280, height: undefined, position: 'centre' },  // ASPECT-PRESERVING
  { name: 'hero',      width: 1920, height: undefined, position: 'centre' },  // ASPECT-PRESERVING
]
```

Die aspect-preserving Varianten sind das, was `PayloadImage`'s srcset
benutzt. Cropped-Varianten würden in beliebigen Container-Aspect-Ratios
mis-framen (zeigen einen anderen Bildausschnitt als das Original).

**Migration-Hinweis**: Beim nachträglichen Hinzufügen einer Sharp-Variante
braucht es BEIDES — Drizzle-Migration für die neuen DB-Spalten + Re-Upload
der alten Bilder via `scripts/regenerate-image-sizes.mjs`.

### 11.6 PayloadMedia (Single-Slot Media-Field)

Statt separates `image` + `video` Feld pro Block: ein einziges `media`-
Upload-Feld. `<PayloadMedia>` pickt zur Render-Zeit nach `mimeType` ob
`<PayloadImage>` oder `<PayloadVideo>` gerendert wird.

Vorteile:
- Editor muss nicht vorab entscheiden, welcher Medientyp in den Slot passt
- Schema-Cleanup (1 Feld statt 2)
- Migration einfacher, wenn Content-Typ später wechselt

Companion-Helper: `isVideoMedia(media)` für Branching-UI (z.B. "Play-Button
nur bei Standbildern overlayen").

### 11.7 Direct-CDN PayloadImage (skip Next.js Image-Optimizer)

`PayloadImage.tsx` rendert ein nacktes `<img>` mit srcset aus den Sharp-
Varianten — **nicht** Next.js' `<Image>`. Die Bytes streamen direkt von der
CDN-Edge statt durchs Next.js' `/_next/image` durchgereicht zu werden.

Trade-offs:
- ✓ Edge-Delivery (echtes CDN, nicht Origin-Pull)
- ✓ Weniger Bandbreite auf dem App-Server
- ✗ Coarser srcset-Granularität (nur die pre-generated Sharp-Sizes)
- → CDN-side Image-Optimizer dazuschalten (Bunny: $9.50/mo) wenn Image-
  Bandwidth zum Engpass wird

CDN-Host wird via `NEXT_PUBLIC_MEDIA_CDN_URL` env (im Template
`src/lib/mediaUrl.ts`) gesetzt. Empty env = Origin-Serving für lokale Dev.

### 11.8 Locale-aware Currency Formatting

`Intl.NumberFormat` per BCP-47-Tag macht Tausender/Dezimal/Symbol-Position
automatisch:

- `de-DE` → `1.500 €`
- `en-GB` → `€1,500`
- `de-CH` → `CHF 1’500` (Apostroph-Prime als Tausender-Trenner!)

Im Template: `src/lib/formatCurrency.ts` mit `LOCALE_MAP` (URL-Locale →
BCP-47). Neue Märkte = eine Zeile in der Map.

### 11.9 Sharp Video-Poster: Cap auf 1200w / Quality 78

`scripts/transcode-video.sh` cappt Poster-Frames auf 1200px Breite (Quality
78 statt 82). Selbst 16:9-Hero-Videos rendern auf typischen Desktops <
1000px breit — 1200w ist Retina-genug, alles darüber wäre verschwendete
Bytes. Q78 ist nicht sichtbar von Q82 zu unterscheiden bei Material, das
nur eine Sekunde flackert bevor das Video startet.

Spart messbar Bandbreite ohne sichtbaren Quality-Loss.

### 11.10 Drizzle-Snapshot-Drift recovern

Raw-SQL-Migrations updaten Drizzles `.json`-Snapshot **nicht**. Wenn man
später `migrate:create` läuft, schlägt es destructive Reverts vor.
Recovery-Pattern:

1. `pnpm payload migrate:create snapshot_rebase` interaktiv laufen lassen.
   "rename" für jeden Spalten-Rename-Prompt antworten, "create" für
   genuinely Neues.
2. Die generierte `.ts`-SQL durch No-Ops ersetzen — der `.json`-Snapshot
   ist das eigentliche Artefakt, das man wollte.
3. Migration läuft als reine Tracking-Marker-Eintrag durch. Zukünftige
   Generationen diff'en gegen die rebased Baseline.

### 11.11 Native Folders feature für Media

Statt hardcoded `folder` select-Field die native Payload-Folders-Feature:

```ts
// In der Collection:
folders: true

// In payload.config.ts:
folders: { browseByFolder: true }
```

Echter Folder-Tree im Admin (drag-drop, nesting). **Wichtig**: Das
deprecated `folder` select-Feld muss komplett entfernt werden — der Name
kollidiert mit Payloads auto-injected `folder`-Relationship. Rename-
Workaround funktioniert nicht.

### 11.13 Deploy: importMap VOR Build, nicht danach

**Symptom**: Schema-Erweiterung greift nicht im Admin-UI nach Deploy. Build ist grün, pm2 hat neu gestartet, neue Page lädt sauber, aber im Admin sieht der Editor das neue Feature nicht. Beispiele aus Boothside: `LinkFeature({ enabledCollections: ['pages'] })` für interne Links im RichText, neuer `BlockRowLabel`-Component, Custom-Sidebar-Field.

**Ursache**: `src/app/(payload)/admin/importMap.js` wird beim Build von webpack gebundled. Wenn die Map vor dem Build nicht regeneriert wurde, bundlet der Build die alte Feature-Liste mit ein. Der Admin-Code im Browser kennt das neue Feature dann nicht. Nach `pnpm generate:importmap` allein passiert nichts — die Map muss durch einen erneuten Build laufen.

**Konsequenz für deploy.sh**: Reihenfolge ist nicht verhandelbar:

```bash
1. git pull / reset
2. pnpm payload migrate           # DB-Schema ziehen
3. pnpm generate:importmap         # ← KRITISCH: hier, NICHT nach Build
4. pnpm build                       # bundled importMap.js mit
5. pm2 restart
```

**Praxis**: Im Template-`scripts/deploy.sh` ist das fest verdrahtet. Bei manuellem Deploy oder anderen Hosting-Setups (Docker, Vercel, etc.) im jeweiligen Build-Step gleichermaßen sicherstellen. Die häufigste Falle: jemand fügt `generate:importmap` als post-build-Hook ein. Falsch — ist dann zu spät, das nächste Build-Bundle ist's der die Wirkung sieht, nicht das aktuelle.

**Browser-Cache-Falle**: selbst bei korrektem Build sieht ein bereits-eingeloggter Admin-User in seinem Browser ggf. das alte Lexical-/Admin-Bundle weil JS-Module aggressiv gecached werden. Hard-Refresh oder Incognito-Tab zum Verifizieren des Live-Stands.

---

### 11.12 Lighthouse-Noise (gegen LCP-Hetzerei impfen)

Lighthouse-LCP variiert ±300–500ms zwischen Runs auf demselben Build
(Bandbreiten-Schwankung, Cold-vs-Warm CDN, CPU-Throttling). Erst nach
3+ Runs gegen die Median bewerten, sonst hetzt man echten Optimierungen
hinter Mess-Noise hinterher. Ein scheinbarer 0,2s-Regress nach Deploy ist
fast immer Cache-Cold + Run-Noise, kein echter Code-Regress.

**Prinzip übertragbar**: Bei jeder Mess-getriebenen Änderung (LCP, TTFB,
Bundle-Size, …) erst Median über 3+ Runs etablieren, *dann* erst
Code-Diff bewerten. Single-Run-Vergleich ist Lottogeld.

---

## 12. Module-Bau, Übersetzbarkeit, Tracking — Prinzipien

Aus der Boothside-Session 2026 destilliert. Die §11-Punkte beschreiben
*was* (Code-Patterns), §12 beschreibt *warum-so* — übertragbar auf jedes
nächste Projekt, auch wenn die konkrete Codezeile anders aussieht.

### 12.1 Pflegbarkeitsregel: Was der Editor sehen können muss, lebt im CMS

**Symptom (anti)**: Eine Seite zeigt eine Headline, die der Editor in der
Admin-UI nirgends finden kann — sie steht hardcoded in einem
Route-Wrapper (`app/[locale]/work/page.tsx`) als String. Editor will sie
ändern → Developer-Ticket → 3 Tage Vorlauf.

**Regel**: *Wenn Editor X erreichen können soll, lebt X im CMS.* Die Route
ist ein dünner Wrapper, der einen `Page`-Doc per Slug fetcht und Blocks
rendert. Hardcoded Strings in Route-Templates sind Schulden, die jeden
Übersetzungs-Sprint blockieren.

**Beispiele aus Boothside**:
- Archive-Index-Seiten (`/work`, `/blog`, `/trade-shows`) sind regulär
  CMS-Seiten mit `isArchive: true` + Hero-Block + Collection-List-Block
- Footer-Spalten 2-N als Array auf dem `footer`-Global, nicht 3 hardcoded
  H5-Sektionen aus drei verschiedenen Sources
- CTAs, Section-Labels, Slogans → Felder, niemals JSX-Strings

Faustregel: Wenn ein Wort übersetzt oder geändert werden könnte, ist es
ein Field. Der einzige sauber-hardcodebare String in einem Block-
Component ist der Tailwind-Class-Name.

### 12.2 "One Element, One Source" — Editor-UI-Konsolidierung

**Symptom (anti)**: Footer hat 3 Spalten. Spalte 1 kommt aus
`SiteSettings.tagline`, Spalte 2 aus `Navigation.footerLinks`, Spalte 3
aus `Footer.legalLinks`. Editor weiß nie, *wo* er was ändert.

**Regel**: Wenn der User EIN UI-Element sieht (= "der Footer"), dann
sollte der Editor EIN Feld dafür haben (oder ein Array das alle
Spalten-Variationen erzeugt). Verteilung über drei Globals ist
Architektur-Bequemlichkeit, die der Editor bezahlt.

**Pattern**: `footer.columns` als Array, jeder Eintrag eine Spalte mit
`heading` + `links[]`. Legal-Links sind dann einfach eine `columns[3]`-
Variation. Logo + Slogan in `columns[1]` bleibt eine Ausnahme weil sie
strukturell in Site-Settings gehört (für Header/Meta-Tags) — dann aber
explizit in der Schema-Description erwähnen: *"Spalten 2-N. Spalte 1
ist Logo + Slogan und kommt aus den Site Settings."*

### 12.3 Übersetzbarkeit ist eine Schema-Disziplin, kein Code-Patch

**Symptom (anti)**: "Wir launchen erstmal in DE, EN machen wir später"
führt regelmäßig zu Schema-Refactor + Datenmigration zwei Monate später.

**Regel**: Jedes Editor-facing Text-Field bekommt von Tag 1 an
`localized: true`. Auch wenn nur eine Sprache aktiv ist. Kosten: ein
Bool. Ersparnis: keine `_locales`-Migration über existierende Daten.

**Detail-Regeln**:
- `localization.fallback: true` und `defaultLocale` setzen — DE-leere
  Felder rendern dann EN, statt der Page leer zu lassen während
  übersetzt wird.
- Locale aus `params` durchreichen (NIEMALS `headers()` lesen — siehe §3).
- Layout-Updates pro Locale gehen über `mergeLocalized` — sonst killt
  ein DE-Save die EN-Items (siehe §2 Localized-Array-Quirk).
- Schema-Description in der Sprache des Editors. Code-Identifier dürfen
  englisch bleiben (`siteName`, `analyticsId`), aber `description: 'Wird
  im Copyright und Meta-Tags verwendet'` erspart 80% der Editor-
  Rückfragen.
- Locale-bewusstes Currency-Formatting via `formatCurrency(value, locale)`
  (siehe §11.8) — niemals `value.toLocaleString()` + manuell €/CHF
  reinfrickeln.

### 12.4 Block-Bau-Prinzipien (Wrapper-System als Vertrag)

Das Wrapper/Container-System (`BlockWrapper` mit `<section>` + `.edge` +
`paddingTop`/`paddingBottom`/`background`/`dividerTop`/`dividerBottom`)
ist nicht "ein Helper", es ist ein **Vertrag**. Wer ihn bricht, zerstört
die Pflegbarkeit:

- **0px zwischen Blocks** — Spacing kommt EXKLUSIV aus dem Wrapper.
  Keine `mt-12` auf dem ersten Element im Block. Sonst kann der Editor
  nicht mehr per `paddingTop`-Slider den Abstand justieren.
- **Background nur am Wrapper** — nicht am inneren Content-Container.
  Sonst macht der Editor ihn `transparent` und es bleibt ein farbiger
  Streifen.
- **Block-Typen-Liste IMMER vollständig pflegen** — neuer Block muss in
  ALLE relevanten `allBlocks`/`detailBlocks`/`blogBlocks`-Arrays
  eingetragen werden, sonst dropt Payload ihn beim Seed silent (siehe
  KNOWN-ISSUES.md).
- **Block-Numbering als shared language** — `m1-page-title`, `m2-hero`,
  `m15-image-video-split`. Wenn Design ein "M7" zeigt, weiß Code +
  Editor sofort welcher Block.
- **Hidden-Toggle statt Delete** — `wrapper.hidden` Field auf jedem
  Block, im Frontend gefiltert. Editor kann Module deaktivieren ohne
  Inhalt zu verlieren.
- **Layout-Felder am Block, nicht in der Page** — `paddingTop`/
  `dividerTop`/etc. auf jedem Block, nicht zentral. So kann der Editor
  pro Instanz feinjustieren.

### 12.5 Tracking-Consent als Event-Vertrag (nicht als if-Chain)

**Symptom (anti)**: GA4-Snippet in `_app.tsx` mit
`if (window.localStorage.getItem('cookie-consent')?.includes('analytics'))`
direkt im Render. Banner-Logik und Tracker-Logik sind verzahnt — neuer
Tracker = überall mitziehen.

**Regel**: Banner und Tracker kommunizieren über einen einzigen
**CustomEvent-Vertrag** (`cookie-consent-update` mit Detail-Payload
`{ necessary, analytics, marketing, externalMedia }`). Banner dispatcht,
Tracker subscribed. Decoupled.

```ts
// Banner (template-CookieBanner.tsx):
window.dispatchEvent(new CustomEvent('cookie-consent-update', { detail: state }))

// Tracker (template-Analytics.tsx):
window.addEventListener('cookie-consent-update', (e) => {
  if (e.detail.analytics) load()
})
```

Vorteile:
- Neuer Tracker (HotJar, Plausible, …) braucht keine Banner-Änderung
- Banner-Variante (1-Click-vs-Granular) tauschbar ohne Tracker-Anpassung
- Returning Visitor: Tracker liest `localStorage` initial selbst —
  funktioniert ohne Re-Dispatch beim Page-Load
- Server kann via Cookie (`cookie-consent=1`) "consent-exists"
  erkennen, *ohne* localStorage zu brauchen

Implementierung: `src/components/Analytics.tsx` (GA4) + `CookieBanner.tsx`
(4 Kategorien) im Template. ID lebt auf `site-settings.analyticsId`.
Leer = kein Tracking, auch wenn Consent erteilt.

### 12.6 A11y ist ein Schema-Choice, kein Polish-Sprint am Ende

**Symptom (anti)**: A11y-Audit zwei Wochen vor Launch findet 47 Issues,
davon 30 "color contrast", 12 "heading order", 5 "missing alt".

**Regel**: A11y-Constraints in den Block-Bau einbauen, nicht hinterher
fixen.

**Konkret**:
- **Heading-Order semantisch, nicht visuell**. Tailwind v4 Preflight
  resettet `<h1>`-`<h6>` auf identische Größe — `<h3 className="text-3xl">`
  und `<h5 className="text-3xl">` rendern *visuell gleich*. Tag-Swap
  zwischen ihnen ist ein **rein semantischer A11y-Fix** ohne Diff. Wer
  nach Visual-Diff prüft sieht nichts → fälschlich verworfen.
- **Decorative Content via `aria-hidden`, nicht `display: none`**. Große
  graue Section-Nummern, dekorative Icons, Trenn-Striche → gehören im
  visual flow, aber nicht im a11y-tree. `aria-hidden="true"` löst das
  + stoppt Lighthouse beim color-contrast-Flaggen.
- **`alt`-Field required + localized auf Media-Collection**. Editor kann
  einen Upload nicht ohne alt-Text speichern. Lieber 5 Sekunden
  Editor-Friction als ein Audit-Issue später.
- **Skip-Link** im Layout (`<a href="#main" className="skip-link">`),
  Default-versteckt, sichtbar bei `:focus` — schon im Template-`globals.css`.

### 12.7 Fehler-Suche: Root-Cause vor Workaround (Disziplin)

Aus einer expliziten Boothside-Session-Direktive: *"wir suchen nicht
nach schnellen oder alternativen Lösungen. wir suchen nach dem fehler
den man beheben kann"*.

**Regel**: Wenn Symptom auftritt → erst die *Mechanik* verstehen, dann
fixen. Wenn der Fix den Mechanismus nicht erklären kann, ist es ein
Workaround, kein Fix. Workarounds akkumulieren als Tech-Schuld; ein
Mechanismus-Fix beseitigt eine ganze Bug-Klasse.

**Beispiel**: Sticky-Nav broken. Workaround wäre `position: fixed` +
manuelles Top-Management. Root-Cause: `overflow: hidden` erzeugt
scroll-containing-block. Fix: `overflow: clip`. Ergebnis: alle sticky-
Children der App profitieren, nicht nur die Nav.

**Beispiel**: Build-Skript silent-fail. Workaround wäre "log mehr".
Root-Cause: `tail` maskiert exit-code, `&&` greift fälschlich. Fix: `if
build; then restart; fi` mit echtem Exit-Code-Check. Ergebnis: jedes
zukünftige Build-Failure-Szenario abgedeckt, nicht nur das spezifische.

**Praxis**: Wenn die einzige Option ein Workaround ist (Library-Bug,
Browser-Bug), das **explizit als Workaround markieren** (Code-Comment +
Re-Eval-Trigger), nicht als regulären Code tarnen. Webpack-Pinning in
`package.json` ist genau so: Comment im Build-Script, Re-Eval-Trigger
"Next 17 GA + 3 Monate Stabilität" in den Docs.

### 12.8 Scope-Disziplin: Nur was gefragt wurde

Aus der Memory-Datei `feedback_scope_discipline.md`: *"only do what was
asked, never adjacent changes"*.

**Regel**: Wenn der Auftrag "Fix den Hover-State auf den Pills" ist,
dann werden NICHT nebenbei drei andere Components aufgeräumt. Auch wenn
sie "while I'm here" naheliegen.

**Warum so streng**: Adjacent-Changes erweitern den Diff, machen
Reviews schwerer, erzeugen Merge-Konflikte, koppeln eigentlich
unabhängige Änderungen aneinander. Plus: User behält Kontrolle über
*was* sich wann ändert.

**Praxis**: Wenn etwas Aufräum-würdig auftaucht während ich an A
arbeite → entweder als Spawn-Task flaggen (bei Sessions die das
unterstützen), oder als "FYI"-Notiz am Ende erwähnen — *nicht*
inline mit-fixen.

---

## Anhang: Projekt-Spezifika

**Nur für Boothside — nicht ins Template übernehmen**:
- `data-accent="amber"` oder `teal` (Brand-Accent — pro Projekt anders)
- Legal-Pages-Content (Impressum mit Markus Gabors Daten)
- Trade-Shows-Seed (BIOFACH, embedded world, SPS, it-sa)
- `boothside.sht.wtf` Staging-Setup (pro Projekt eigene Domain)
- Hetzner-IP `178.104.236.224`
- 1Password-Vault-Namen (Undraft-spezifisch)
