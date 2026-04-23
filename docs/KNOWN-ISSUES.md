# Known Issues — Quick-Lookup

Kuratierte Liste der **häufigsten Fehler** in diesem Stack (Payload v3 + Next.js 16 + PostgreSQL + PM2/nginx) und ihrer direkten Fixes. Wenn du auf einen Fehler triffst — **erst hier suchen**, dann erst weiter debuggen.

Aufgebaut als: **Symptom → Ursache → Fix → Deep-Dive**.
Deep-Dive-Verweise gehen in `LEARNINGS.md` (Detail-Erklärungen) oder `DEPLOYMENT.md` (Setup-Kontext).

---

## Navigation

- [Build & Deploy](#build--deploy)
- [Payload / CMS](#payload--cms)
- [Datenbank & Migrations](#datenbank--migrations)
- [i18n / Lokalisierung](#i18n--lokalisierung)
- [Bilder & Performance](#bilder--performance)
- [nginx / Reverse Proxy](#nginx--reverse-proxy)
- [PM2 / systemd / Server](#pm2--systemd--server)
- [Admin-UI](#admin-ui)

---

## Build & Deploy

### `next build` failt mit `relation "..." does not exist`
**Ursache:** DB ist bei Build nicht erreichbar (CI-Environment ohne DB-Zugang), oder Schema fehlt auf Prod.
**Fix:** Entweder `generateStaticParams` in try/catch wrappen (on-demand fallback) ODER Migration laufen lassen (`pnpm payload migrate`).
**Deep-Dive:** [LEARNINGS.md §4 — SSG via generateStaticParams](LEARNINGS.md#ssg-via-generatestaticparams), [DEPLOYMENT.md §7 — Build + Schema-Migration](DEPLOYMENT.md).

```tsx
export async function generateStaticParams() {
  try {
    const pages = await payload.find({ collection: 'pages', limit: 100 })
    return pages.docs.map((p) => ({ slug: p.slug }))
  } catch {
    return []  // DB unreachable → on-demand generation
  }
}
```

### `next build` failt mit TypeScript-Errors aus `seed.ts`
**Ursache:** Next.js checkt TypeScript über das gesamte Projekt, inkl. Dev-Scripts.
**Fix:** `seed.ts` + `*.example.ts` aus tsconfig `exclude`.
**Deep-Dive:** [DEPLOYMENT.md — Build-Fehler durch seed.ts](DEPLOYMENT.md).

```json
// tsconfig.json
{ "exclude": ["node_modules", "**/*.example.ts", "**/*.example.tsx", "src/seed.ts"] }
```

### `next build` OOM (Out-of-Memory)
**Ursache:** Next.js 16 + Payload brauchen bei größeren Schemas deutlich mehr Heap.
**Fix:** `NODE_OPTIONS="--max-old-space-size=8000"` im `build`-Script (ist bereits im Template).
**Bei CX22 (4GB RAM):** reicht meist mit Swap; wenn nicht, `CCX13` (dediziert, 8GB) oder lokal bauen + rsync.

### `pnpm build` löscht den Image-Cache
**Symptom:** Nach Deploy ist LCP 3-4s statt 100ms — weil `/var/cache/nginx/images/` zwar noch da, aber der Next.js-intern Sharp-Output-Cache in `.next/cache/images/` weg ist.
**Ursache:** `rm -rf .next` vor Build.
**Fix:** Selektiv löschen, **nicht** den ganzen Ordner:

```bash
rm -rf .next/server .next/static .next/types .next/build-manifest.json .next/app-build-manifest.json
pnpm build
```
**Deep-Dive:** [LEARNINGS.md §4 — Deploy sollte .next/cache nicht löschen](LEARNINGS.md).

### `output: 'standalone'` bricht `next start`
**Symptom:** Pages liefern 404 oder falschen Content, obwohl der Build durchgelaufen ist.
**Ursache:** `output: 'standalone'` ist für Docker gedacht. Bei PM2/nativem `next start` stimmen die Pfade nicht.
**Fix:** `output: 'standalone'` aus `next.config.ts` entfernen (oder nie reinschreiben).
**Deep-Dive:** [DEPLOYMENT.md — output standalone](DEPLOYMENT.md).

---

## Payload / CMS

### Lokalisierte Array-Updates löschen andere Locales ("Localized-Array-Quirk")
**⭐ Wichtigstes Payload-Gotcha.**
**Symptom:** Nach `p.update({ locale: 'de', data: { layout: [...] } })` sind die englischen Inhalte weg.
**Ursache:** Payload ersetzt das komplette Array, wenn Items keine `id` haben.
**Fix:** `mergeLocalized`-Helper nutzen (`src/lib/mergeLocalized.ts`). Fetch EN → mit IDs merge → DE-Update.
**Deep-Dive:** [LEARNINGS.md §2 — Das Localized-Array-Quirk](LEARNINGS.md#das-localized-array-quirk-der-wichtigste).

### Blocks werden beim Seed silent gedropt
**Symptom:** Ein Block wird geseedet, landet aber nicht in der DB. Kein Error.
**Ursache:** Block ist in der Collection-Liste (`allBlocks`/`detailBlocks`/`blogBlocks`) der Ziel-Collection nicht registriert.
**Fix:** Block in allen relevanten Listen eintragen und `pnpm generate:importmap`.
**Deep-Dive:** [LEARNINGS.md §2 — allBlocks / detailBlocks / blogBlocks](LEARNINGS.md).

### SEO-Tab erscheint doppelt im Admin
**Ursache:** `@payloadcms/plugin-seo` UND custom `seoFields`-Group beide aktiv.
**Fix:** Nur das Plugin nutzen. Im Frontend auf `doc.meta?.*` zugreifen (nicht `doc.seo?.*`).

```typescript
seoPlugin({
  collections: ['pages', 'events', /* ... */],
  uploadsCollection: 'media',
  generateTitle: ({ doc }) => doc?.title ? `${doc.title} — <Site>` : '<Site>',
  generateDescription: ({ doc }) => doc?.excerpt || '',
})
```
**Deep-Dive:** [LEARNINGS.md §2 — plugin-seo vs. custom seoFields](LEARNINGS.md).

### Media-Search crasht mit blank rechter Seite
**Symptom:** Im Admin "Media"-Collection → Suche tippen → rechte Seite wird weiß.
**Ursache:** `listSearchableFields` enthält ein select/enum-Feld (z.B. `folder`). Postgres ILIKE gegen enum crasht.
**Fix:**
```typescript
admin: {
  useAsTitle: 'filename',
  defaultColumns: ['filename', 'folder', 'alt', 'updatedAt'],
  listSearchableFields: ['filename'],  // NUR text-like fields
}
```

### `useAsTitle` fehlt bei Upload-Collections → diffuse Admin-UI-Bugs
**Symptom:** Relationship-Picker zeigt UUIDs statt Dateinamen; sporadische Crashes.
**Fix:** `admin.useAsTitle: 'filename'` immer setzen bei Upload-Collections.

### Custom Admin-Component hat keinen Effekt
**Symptom:** Block-Label, Sidebar-Komponente o.ä. ist im Code definiert, aber Admin zeigt Default.
**Ursache:** `importMap.js` nicht regeneriert.
**Fix:**
```bash
pnpm generate:importmap
```
Nach JEDER Schema-Änderung mit Custom-Component. Routine vor jedem Build.

### `RowLabel` vs `Label` bei Blocks
**Symptom:** TypeScript-Fehler `TS2353 Object literal may only specify known properties` bei `admin.components.RowLabel` auf einem Block-Type.
**Ursache:** Blocks haben `Label`, nur `type: 'array'`-Fields haben `RowLabel`.
**Fix:**
```typescript
// ❌ Block:
admin: { components: { RowLabel: ... } }
// ✅ Block:
admin: { components: { Label: ... } }
```
Der `useRowLabel`-Hook funktioniert trotzdem in beiden — misleading name.

### Payload-ID vs. Slug in URL-Parametern
**Symptom:** `?pkg=starter` matcht nie, weil `doc.id` verglichen wird (Integer in Postgres).
**Fix:** Slug als Source-of-Truth. Vergleiche `t.slug || String(t.id)`, nie nur `t.id`.

### Access-Control: API liefert 401 für public Daten
**Symptom:** Frontend `fetch('/api/site-settings')` → 401.
**Ursache:** Payload default ist `access: authenticated`.
**Fix 1 (bevorzugt):** Auf dem Server `payload.findGlobal(...)` direkt aufrufen (Server-Component). Bypassed Access-Control.
**Fix 2:** `access: { read: () => true }` explizit setzen bei wirklich public Collections/Globals.

---

## Datenbank & Migrations

### `relation "..." does not exist` auf Prod nach Deploy
**Ursache:** Migration fehlt — Payload v3 pusht Schema in Prod **nicht automatisch**, auch wenn `db.push: true` in der Config steht (gilt nur für `pnpm dev`).
**Fix:**
```bash
pnpm payload migrate:create initial --force-accept-warning
pnpm payload migrate
```
**Deep-Dive:** [DEPLOYMENT.md §7 — Build + Schema-Migration (Gotcha #1)](DEPLOYMENT.md).

### `migrate:create` hängt in CI
**Ursache:** Interaktiver Prompt bei mehrdeutigen Schema-Changes ("rename or create?").
**Fix:** `--force-accept-warning` (akzeptiert "create") oder `expect`-Wrapper:
```bash
expect -c '
  set timeout 180
  spawn pnpm payload migrate:create <name>
  expect { -re {created or renamed} { send "\r"; exp_continue } eof }
'
```

### "Unknown locale" nach Locale-Entfernung
**Symptom:** Postgres-Query failed mit `unknown locale`.
**Ursache:** Verwaiste `_locales`-Tabellen-Einträge mit alten Locale-Codes.
**Fix:**
```sql
DELETE FROM <collection>_locales WHERE _locale NOT IN ('de', 'en');
```

### `fallback: true` verschleiert fehlende DE-Übersetzungen
**Symptom:** Frontend sieht übersetzt aus, DB-Spalte ist aber leer.
**Fix:** DB direkt prüfen:
```sql
SELECT _locale, col FROM table_locales ORDER BY _locale LIMIT 8;
```

---

## i18n / Lokalisierung

### Alle Pages werden dynamic (kein ISR) trotz `revalidate = 60`
**Ursache:** Irgendwo wird `headers()` aufgerufen — z.B. in einer `currentLocale()`-Helper-Funktion.
**Fix:** Locale aus `params` durchreichen, nicht aus `headers()` lesen. Jede Component bekommt `locale` als Prop.
**Deep-Dive:** [LEARNINGS.md §3 — Für echtes SSG: locale aus params](LEARNINGS.md).

### Falsche Sprache bei Social-Shares / Google-Index
**Ursache:** Header-based Locale-Detection (Accept-Language). Google crawlt mit EN-Header, User shared in EN, auch wenn das User-facing DE ist.
**Fix:** URL-Segment-Pattern (`/en/...`, `/de/...`). Siehe `middleware.example.ts`.

### `hasLocalePrefix` / Links vergessen locale
**Symptom:** `/about` statt `/de/about`.
**Fix:** `SmartLink` bekommt `locale`-Prop. `resolveUrl(link, locale)` prepended locale-Segment.

---

## Bilder & Performance

### LCP-Image 3-4s statt 100ms nach Deploy
**Ursache:** Next.js Sharp-Cache leer (wurde gelöscht) oder nginx-Cache nicht konfiguriert.
**Fix:**
1. `minimumCacheTTL: 2592000` in next.config.ts
2. nginx `proxy_cache` vor `/_next/image`
3. `pnpm prewarm` nach Deploy
4. Build nicht `rm -rf .next` machen (siehe oben)
**Deep-Dive:** [LEARNINGS.md §4 — Next.js Image Optimizer braucht persistent Cache](LEARNINGS.md).

### Bilder laden nicht wenn Basic Auth aktiv
**Symptom:** Frontend zeigt Broken-Image-Icons trotz gültigem Login.
**Ursache:** `<img>`-Requests senden keinen Auth-Header.
**Fix:** `auth_basic off` auf `/_next/image`, `/_next/static`, `/api/*`.
**Deep-Dive:** [DEPLOYMENT.md §9 (Gotcha #4)](DEPLOYMENT.md).

### Next.js liefert `x-nextjs-cache: MISS` konstant
**Symptom:** Jeder Request triggert Sharp-Processing.
**Fix:** nginx `proxy_cache` dazwischen. Nicht auf Next.js-Built-in-Cache allein verlassen.

### Video-Upload funktioniert, aber kein WebM generiert
**Symptom:** MOV/MP4 hochgeladen, `webmUrl` bleibt leer. Upload-Log: `[transcode] spawn failed: spawn ffmpeg ENOENT`.
**Ursache:** ffmpeg nicht installiert — oder nicht im `$PATH` des PM2-Prozesses.
**Fix:**
```bash
apt-get install -y ffmpeg
systemctl restart pm2-<app>   # PATH neu einlesen
```
**Deep-Dive:** [DEPLOYMENT.md §1 — ffmpeg ist nicht optional](DEPLOYMENT.md).

### Video-Upload `afterChange`-Hook blockt Re-Uploads
**Symptom:** Admin "Datei ersetzen" → kein neuer WebM generiert.
**Ursache:** Hook returned bei `operation !== 'create'` früh.
**Fix:** Bei `update` prüfen, ob Filename sich geändert hat ODER `webmUrl` fehlt (Recovery).
**Deep-Dive:** [DEPLOYMENT.md — Video-Transcode-Hook](DEPLOYMENT.md).

---

## nginx / Reverse Proxy

### 502 Bad Gateway
**Checkliste:**
1. PM2-Prozess läuft? `pm2 status`
2. Next.js auf Port 3000 erreichbar? `curl http://127.0.0.1:3000`
3. nginx-Config valid? `nginx -t`
4. `proxy_pass` Port stimmt?

### certbot-Renewal hängt an Basic Auth
**Ursache:** `/.well-known/acme-challenge/` wird von Basic Auth geblockt.
**Fix:** certbot exposed diese Route automatisch separat (HTTP-01) — kein Eingriff nötig. Nur sicherstellen, dass nicht selbst ein `location /.well-known/` mit auth_basic angelegt wurde.

### Canonical-Domain + 301-Redirects
**Symptom:** Duplicate-Content bei Google; `.de` und `.com` indexieren beide.
**Fix:**
```nginx
server {
    listen 443 ssl http2;
    server_name www.example.com example.de www.example.de;
    return 301 https://example.com$request_uri;
}
```
Eine Canonical, alle anderen 301.

### `/admin`-Login brute-force-angreifbar
**Fix:** Rate-Limit in nginx:
```nginx
limit_req_zone $binary_remote_addr zone=admin_login:10m rate=10r/m;

location /api/users/login {
    auth_basic off;
    limit_req zone=admin_login burst=5 nodelay;
    limit_req_status 429;
    proxy_pass http://127.0.0.1:3000;
    # ...
}
```

---

## PM2 / systemd / Server

### `pm2 start pnpm` funktioniert nicht zuverlässig
**Symptom:** PM2 restartet ständig oder erkennt Exit-Codes falsch.
**Fix:** Direkt auf das `next`-Binary zeigen:
```js
// ecosystem.config.cjs
script: 'node_modules/next/dist/bin/next',
args: 'start -p 3000 -H 127.0.0.1',
```
**Deep-Dive:** [DEPLOYMENT.md §8 (Gotcha #3)](DEPLOYMENT.md).

### PM2-Prozess überlebt Reboot nicht
**Fix:**
```bash
env PATH=$PATH:/usr/bin pm2 startup systemd -u <app> --hp /home/<app> | tail -3 | head -1 | bash
systemctl enable pm2-<app>
sudo -u <app> -H bash -c "pm2 save"
```

### ffmpeg / andere Binaries funktionieren erst nach reload
**Ursache:** PM2-systemd-Service erbt PATH aus `/etc/environment` — nicht aus deiner Shell.
**Fix:** `systemctl restart pm2-<app>` nach Binary-Installs.

### 1Password-SSH-Agent erreicht Server nicht
**Fix:**
```bash
export SSH_AUTH_SOCK="$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
```
Plus in `~/.ssh/config` `IdentityFile` auf den **Public Key** setzen (nicht Private).
**Deep-Dive:** [LEARNINGS.md §6 — 1Password SSH-Agent](LEARNINGS.md).

### fail2ban zeigt nur 1 Jail nach frischer Installation
**Fix:**
```bash
fail2ban-client reload
fail2ban-client status    # → sollte 3 Jails zeigen (sshd + nginx-http-auth + nginx-limit-req)
```

---

## Admin-UI

### Block "Section ausblenden" greift nicht
**Voraussetzung:** Block nutzt `makeWrapperFields()` und ist per `withRowLabel()` registriert.
**Fix bei Missing-Toggle:** Migration laufen lassen + `generate:importmap`:
```bash
pnpm payload migrate:create add_block_hidden_toggle
pnpm payload migrate
pnpm generate:importmap
```

### `isHomepage`-Checkbox erlaubt mehrere Homepages
**Fix:** `beforeValidate`-Hook enforcet Singleton-Constraint (siehe `src/collections/Pages.ts`).

### Live Preview zeigt falsche URL
**Ursache:** Hardcoded Collection-Paths in `payload.config.ts → livePreview.url`.
**Fix:** Jede Collection explizit mappen:
```typescript
livePreview: {
  url: ({ data, collectionConfig }) => {
    if (collectionConfig.slug === 'pages') return data.slug === 'home' ? '/' : `/${data.slug}`
    if (collectionConfig.slug === 'events') return `/events/${data.slug}`
    // ...
  },
}
```

---

## Wenn nichts hilft

1. `pm2 logs <app> --lines 200` — sieht man meistens direkt wo's hakt
2. `journalctl -u pm2-<app> -n 100 --no-pager` — systemd-Level
3. `sudo -u postgres psql -d <db> -c "\dt"` — existieren die Tables?
4. DB-Content direkt prüfen statt durch Payload zu gehen
5. Einen **neuen Eintrag in dieser Datei** hinzufügen, wenn du ein neues Issue gelöst hast — future-you dankt dir.

---

## Beitragen

Wenn du einen neuen Bug gelöst hast:
1. Eintrag unter passender Kategorie hinzufügen
2. Format: **Symptom → Ursache → Fix → Deep-Dive-Link**
3. Wenn Ursache komplex: Detail-Kapitel in `LEARNINGS.md` hinzufügen, von hier verlinken
4. Quick-Lookup-Stil: kurz. Keine Einleitung, kein "betroffene Files XY" — direkt zur Sache.
