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
- [CSS / Layout](#css--layout)
- [Mail / Postmark](#mail--postmark)
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

### `next build` "Compiled successfully" → Server crasht mit `Could not find pages manifest`
**Symptom:** Build meldet "Compiled successfully", `pm2 restart` läuft sauber, aber jeder Request resultiert in `InvariantError: Could not find pages manifest` (500). Datei `pages-manifest.json` fehlt im `.next/server/`.
**Ursache:** Next.js 16 Default-Production-Build via Turbopack ist intermittent kaputt — Manifest wird nicht generiert.
**Fix:** Build mit Webpack pinnen — `next build --webpack` (ist im Template-`package.json` so eingestellt).
**Deep-Dive:** [LEARNINGS.md §11.1 — Webpack pinnen](LEARNINGS.md#111-nextjs-16-webpack-pinnen-turbopack-prod-ist-instabil).

### Site nach Deploy down: pm2 restartet auf broken `.next`
**Symptom:** Build "succeeded" (laut Deploy-Log), trotzdem 502/Crash-Loop.
**Ursache:** Klassisch — `pnpm build 2>&1 | tail -N && pm2 restart`. `tail` returniert exit 0 auch bei Build-Failure, das `&&` greift fälschlich, pm2 startet ohne `.next`.
**Fix:** Niemals `&&` zwischen Build und Restart. Wrapper-Script mit `set -euo pipefail` + echtem `if/then/else` um den Build legen — `scripts/deploy.sh` im Template ist die Referenz.
**Deep-Dive:** [DEPLOYMENT.md — Anti-Pattern A](DEPLOYMENT.md#anti-pattern-a-pnpm-build-21--tail-n--pm2-restart).

### `pnpm install` bricht ab mit `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`
**Symptom:** Im Deploy-Script (oder beim manuellen `ssh host "pnpm install"`) bricht pnpm ab mit:
```
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY  Aborted removal of modules directory due to no TTY
If you are running pnpm in CI, set the CI environment variable to "true", or set "confirmModulesPurge" to "false".
```
**Ursache:** pnpm möchte interaktiv bestätigen lassen, dass `node_modules` neu gebaut wird (z.B. nach Lockfile-Drift oder Hoisting-Mismatch). Eine non-interactive SSH-Session ohne TTY kann keinen Prompt anzeigen → Abbruch.
**Fix:** Vor pnpm-Aufrufen `CI=true` setzen, dann werden Confirmations automatisch akzeptiert:
```bash
ssh "$HOST" bash -s <<EOF
  export CI=true
  pnpm install --frozen-lockfile
  ...
EOF
```
Alternative: server-seitig einmal `pnpm config set confirmModulesPurge false`. Im Deploy-Script ist `CI=true` aber robuster (kein Server-State-Drift zwischen Maschinen).

### `bash: [: -eq: unary operator expected` während ssh-Deploy
**Symptom:** Inline-Deploy via `ssh host 'sudo -u user -i bash -c "..."'`, im Log taucht `unary operator expected` auf, Variablen scheinen leer.
**Ursache:** Outer-Remote-Shell expandiert `$?` (und alle `\$VAR`-Konstrukte) im `bash -c`-Doppelquote-Argument BEVOR der Inner-Bash sie sieht. Quote-Escape-Hell, fundamentell unzuverlässig.
**Fix:** Real-Script ablegen (`scripts/deploy.sh`), mit einem einzigen `ssh`-Call ohne `bash -c` starten: `ssh host 'sudo -u user -i /path/to/deploy.sh'`.
**Deep-Dive:** [DEPLOYMENT.md — Anti-Pattern B](DEPLOYMENT.md#anti-pattern-b-nested-ssh--sudo--bash--c--mit-quote-escaping).

### `next build` failt silent — Log endet bei "Creating an optimized production build..."
**Symptom:** deploy.log ist 12 Zeilen, exit 1, kein Stack-Trace, kein TypeScript-Fehler. Letzte sichtbare Zeile: `Creating an optimized production build ...` dann direkt `ELIFECYCLE Command failed with exit code 1`. pm2 läuft mit altem Build weiter (deploy.sh sauber abgebrochen). Lokal baut der gleiche Commit problemlos.
**Ursache:** Linux OOM-Killer terminiert den Build-Node-Process. Auf Hetzner CX22 (4 GB RAM) ohne Swap kollidieren laufender pm2-Process (~2 GB) + Build-Heap (~2 GB) > 4 GB → Kernel killt.
**Diagnose:** `ssh host 'dmesg -T | tail -30 | grep -i oom'` zeigt den Kill-Event mit PID + RSS.
**Fix:** 4 GB Swap-File einrichten (siehe [DEPLOYMENT.md → Server vorbereiten → Swap-File](DEPLOYMENT.md#swap-file-einrichten-pflicht-auf-hetzner-cx22)). Einmaliger Setup, persistent via `/etc/fstab`. Build hat dann Puffer.
**Anti-Pattern:** Nicht `--max-old-space-size` runtersetzen — das produziert "JavaScript heap out of memory" Errors die das Problem nur lautstark statt silent machen. Swap ist die robustere Lösung.

### sitemap.xml zeigt alte Slugs nach Editor-Änderungen, refresht erst beim nächsten Deploy
**Symptom:** Editor benennt im Admin einen Page/Post/Event-Slug um. Die Detail-URL funktioniert sofort (200), die alte URL gibt 404, aber `sitemap.xml` zeigt tagelang noch den alten Slug. Search Console submittet die invalide URL.
**Ursache:** Ohne explizites `export const dynamic` oder `export const revalidate` klassifiziert Next.js `sitemap.xml` als `○ (Static)` — einmal beim Build vorgerendert, dann gecached bis `rm -rf .next` (nächster Deploy).
**Fix:** In `src/app/sitemap.ts`:
```ts
export const dynamic = 'force-dynamic'
```
Sitemap wird dann als `ƒ (Dynamic)` gebaut, jede Request frisch aus der DB. Cost: 5 DB-Queries pro Sitemap-Fetch — Google fetched die Sitemap selten, Load ist irrelevant.
**Warum nicht `revalidate = 60`:** ISR pre-rendert beim Build, kostet Build-RAM (~150 MB), kann auf RAM-knappen Hetzner-Boxen den Build OOM-killen. `force-dynamic` skipped Pre-Render komplett.
**Deep-Dive:** [SEO.md — Sitemap dynamic rendering](SEO.md#sitemap-dynamic-rendering).

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

### Editor pflegt SEO-Felder, aber im Frontend kommt nichts an
**Symptom:** Search Console listet Detail-Seiten als "Crawled — currently not indexed" oder "Duplicate without user-selected canonical". HTML-Head zeigt entweder doppelten Brand-Suffix im Title oder die englische Site-Default-Description auf allen Detail-Seiten — obwohl der Editor pro Doc Title/Description in beiden Sprachen gepflegt hat.
**Ursache:** Die Route hat eine eigene `generateMetadata`, die `doc.meta` ignoriert (z.B. nur `return { title: doc.title + ' — Brand' }`). `buildPageMetadata` aus `lib/seo.ts` wird nicht aufgerufen.
**Fix:** Jede Route geht durch `buildPageMetadata(doc, { pathSuffix: '...' })`. Verifikation:
```bash
curl -sL https://site.com/your/page \
  | grep -E '<title>|<meta name="description"|<link rel="canonical"|hreflang'
```
**Deep-Dive:** [SEO.md](SEO.md), [LEARNINGS.md §9 — Detail-Routen mit eigener generateMetadata](LEARNINGS.md#9-bugs-die-sich-wiederholen-können).

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

### RichText-Editor zeigt keine Toolbar (kein Link / Bold / Slash-Menü)
**Symptom:** Ein Block hat ein RichText-Field, im Admin lädt der Editor, aber: keine schwebende Toolbar bei Text-Selektion, keine fixe Button-Reihe oben, kein Slash-Menü. Editor kann nichts formatieren oder verlinken obwohl die Features im Schema registriert sind (`BoldFeature`, `LinkFeature` etc.).
**Ursache:** `lexicalEditor({ features: () => [...] })` ist **replace, nicht merge**. Sobald du eine eigene Features-Liste übergibst, sind ALLE Defaults weg — auch `InlineToolbarFeature` und `FixedToolbarFeature`, die die UI für die anderen Features rendern. Die Bold/Link/etc. sind registriert, aber kein Toolbar-Component zeigt einen Button dafür.
**Fix (zwei Optionen):**

A. Defaults erweitern statt ersetzen:
```ts
lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures,
    LinkFeature({ enabledCollections: ['pages'] }),
  ],
})
```

B. Vollständig explizit, dann Toolbars manuell registrieren:
```ts
import { InlineToolbarFeature, FixedToolbarFeature, ParagraphFeature, BoldFeature, LinkFeature } from '@payloadcms/richtext-lexical'

lexicalEditor({
  features: () => [
    InlineToolbarFeature(),     // Floating-Toolbar bei Text-Selektion
    FixedToolbarFeature(),       // Always-visible Button-Reihe oben
    ParagraphFeature(),
    BoldFeature(),
    LinkFeature({ enabledCollections: ['pages'] }),
  ],
})
```

Option B ist sinnvoll wenn du gezielt ein eingeschränktes Feature-Set willst (kein Heading, kein Code, etc.), z.B. in einem `bodyTextField`-Helper für Block-Body-Copy.
**Deep-Dive:** [LEARNINGS.md §11.14](LEARNINGS.md#1114-lexicalfeatures-replace-statt-merge).

### Neue Lexical-Feature greift nicht im Admin (Link-Toolbar fehlt etc.)
**Symptom:** Schema wurde erweitert (z.B. `LinkFeature({ enabledCollections: ['pages'] })` für interne Links im RichText), Code committed + deployed, Build grün — im Admin-UI taucht das Feature aber nicht auf. Editor sieht keinen Link-Button, oder das Internal/External-Toggle erscheint nicht.
**Ursache:** Die `importMap.js` enthält nicht nur Custom-Components sondern auch die Feature-Registries für Lexical. Wird sie nicht regeneriert + im nächsten Build mit-gebundlet, dann hat der gebaute Admin-Code die alte Feature-Liste.
**Fix:** `generate:importmap` IMMER VOR `pnpm build` laufen lassen, nicht danach. Reihenfolge: migrate → generate:importmap → build → restart. Im Template-`scripts/deploy.sh` ist das so eingebaut. Wer manuell deployed: nicht vergessen.
**Browser-Cache:** Selbst nach korrektem Build sieht der Admin-User in seinem Browser ggf. noch das alte Bundle. Hard-Refresh (`Cmd+Shift+R` / `Ctrl+F5`) oder Incognito-Tab zur Verifikation.
**Deep-Dive:** [LEARNINGS.md §11.13](LEARNINGS.md#1113-deploy-importmap-vor-build).

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

### `migrate:create` schlägt destructive Reverts vor (Drizzle-Snapshot-Drift)
**Symptom:** Eine soeben gerade nochmal `migrate:create`-aufgerufene Migration enthält `DROP COLUMN`s für Spalten, die du nie weghaben wolltest.
**Ursache:** Eine vorherige Raw-SQL-Migration hat das DB-Schema verändert, Drizzles `.json`-Snapshot aber nicht mit-aktualisiert. Drizzle diff't gegen die alte Baseline.
**Fix:** Snapshot rebasen — siehe [LEARNINGS.md §11.10](LEARNINGS.md#1110-drizzle-snapshot-drift-recovern). Kurz: `migrate:create snapshot_rebase` interaktiv durchspielen, dann die generierte SQL durch No-Ops ersetzen, der `.json`-Snapshot ist das Artefakt.

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

### Video-Audio klingt verzerrt / pumpt
**Symptom:** Transcoded WebM spielt ab, aber Audio hat hörbare Artefakte —
"Pumpen" bei Peaks, metallischer Unterton, sporadisches Knirschen. Besonders
bei kurzen Handy-Voice-Recordings.

**Ursache-Kandidaten (nach Häufigkeit):**

1. **CBR bei niedriger Bitrate.** `-b:a 96k` *ohne* `-vbr on` heißt
   constant bitrate: Peaks werden gestaucht, Stille verbraucht dieselbe
   Bandbreite wie Sprache. Resultat: Pumping.
2. **Samplerate-Mismatch raten lassen.** Kein explizites `-ar 48000` →
   Opus und swresample verhandeln die Rate pro Stream neu; bei 44.1 kHz
   Source gibt's subtile Resampling-Glitches (Opus braucht 48 kHz intern).
3. **Mono-Input ohne `-ac`.** Browser-Decoder-Pfade für Mono-Opus sind
   historisch weniger getestet als für Stereo.
4. **`-application voip`** (Opus-Auto-Detect) statt `audio` — komprimiert
   "sprachähnliche" Signale aggressiver, verzerrt aber Musik / Umgebungston.

**Fix (Encoder-Flags):**
```bash
-c:a libopus -b:a 128k -vbr on -compression_level 10 \
-ar 48000 -ac 2 -application audio
```
- VBR mit 128k Zielrate (statt CBR 96k) → sauber bei Peaks, sparsam bei Stille.
- Explizit 48 kHz + Stereo-Upmix → konsistenter Decoder-Pfad.
- `compression_level 10` = max Qualität (langsamer encode; irrelevant weil
  fire-and-forget im Background).

**Wichtig:** 44.1 kHz ist bei Opus/WebM nicht möglich ohne doppeltes
Resampling. Wer das Original-Audio bit-identisch behalten will, muss den
Container-Output auf MP4 wechseln (AAC ist in WebM nicht erlaubt) und
`-c:a copy` nutzen — dann keine Opus-Transcodierung mehr.

**Deep-Dive:** [FEATURES.md — Video-Transcoding](FEATURES.md).

### Re-Transcode eines bestehenden WebM-Files
**Symptom:** Encoder-Flags im Hook wurden verbessert, aber existierende WebMs
hängen noch mit alten Einstellungen in der Media-Library.

**Fix (Server-seitig, ohne Admin-Reupload):**
```bash
cd /opt/<app>/media
sudo -u <app> ffmpeg -y -i <file>.MOV \
  -c:v libvpx-vp9 -crf 32 -b:v 0 -deadline good -cpu-used 4 \
  -c:a libopus -b:a 128k -vbr on -compression_level 10 \
  -ar 48000 -ac 2 -application audio \
  <file>.webm
```

`webm_url` in der DB ist bereits gesetzt — File einfach überschreiben,
Frontend liefert den neuen Stream beim nächsten Request aus. Keine
DB-Aktion nötig, es sei denn der Dateiname ändert sich.

### `<video>` in CSS-Grid sprengt Track, frisst Gap
**Symptom:** Ein CSS-Grid-Block mit zwei Kindern (z.B. Image + Video im
`m15-image-video-split`-Muster) zeigt technisch korrekten Gap (DevTools
Grid-Overlay und `getComputedStyle` sagen "gap funktioniert"), aber
**visuell liegen die Kinder direkt aneinander** — kein sichtbarer Abstand.
Eines der Tiles (das Video) wirkt im echten Browser merklich breiter
als im Screenshot-Test oder während Dev-Reload.

**Ursache (häufig und schwer zu finden):** Ein `<video>`-Element meldet
nach Metadata-Load seine **intrinsische Video-Breite** (z.B. 1920×1080)
an den Parent. Grid-Items haben per Default `min-width: auto`, was nach
CSS-Spec `min-content` bedeutet — und für `<video>` ist `min-content`
genau die native Video-Breite. Ergebnis: Der Track wächst über `1fr` hinaus,
das Nachbar-Tile wird visuell überdeckt, der Gap verschwindet.

**Warum headless-Tests das oft übersehen:** Puppeteer/headless-Chrome
mit `readyState: 0` hat das Video noch nicht geladen → `videoWidth: 0`
→ kein Überlauf → Messungen sehen korrekt aus. Im echten Browser mit
`preload="metadata"` lädt die Dimension nach wenigen 100ms und der
Layout-Shift passiert.

**Fix:**
```css
/* Klassischer Grid-Overflow-Fix: min-width: 0 auf die Grid-Items */
.image-video-split__image,
.image-video-split__video {
  min-width: 0;
}
```

Zusätzlich sauberer (aber nicht strikt nötig): Video in einen absolut
positionierten Inner-Wrapper packen, damit es komplett aus dem normalen
Flow isoliert ist:

```tsx
<div className="image-video-split__video">
  <div className="image-video-split__video-inner">
    <video controls preload="metadata" playsInline>
      {video.webmUrl && <source src={video.webmUrl} type="video/webm" />}
      <source src={video.url} type={video.mimeType || 'video/mp4'} />
    </video>
  </div>
</div>
```

```css
.image-video-split__video-inner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**Anti-Pattern** (führt zu demselben Symptom aus anderer Richtung): Wer
dem Video-Tile ein `aspect-ratio: 4/3` gibt, um es höhengleich zum
Image-Tile zu halten, triggert dieselbe Expansion: Bei `height`
(geerbt via `align-items: stretch`) und explizitem `aspect-ratio`
berechnet der Browser die **Width aus Height × Ratio** und ignoriert
die `1fr`-Track-Breite wieder. Lösung: Höhe per `align-items: stretch`
vom Image-Tile (dessen `aspect-ratio` definiert die Track-Höhe) erben
lassen — ohne zusätzliches `aspect-ratio` auf dem Video-Tile.

### Neue Sharp-`imageSize` greift auf Alt-Uploads nicht
**Symptom:** Nach Hinzufügen einer neuen `imageSizes`-Variante (z.B. `medium-w`) fehlen die zugehörigen URLs / DB-Spalten für bereits existierende Media-Docs. PayloadImage's srcset enthält nur `hero` + Original.
**Ursache:** Sharp generiert Varianten nur **bei Upload**. Alte Docs bleiben mit den alten Varianten.
**Fix (zwei Schritte):**
1. Drizzle-Migration für die neuen DB-Spalten (`_url`, `_width`, `_height`, `_filesize`, `_mime_type`, `_filename`, `_focal_x`, `_focal_y` für jede neue Variante in jeder localized-Tabelle).
2. `pnpm exec node scripts/regenerate-image-sizes.mjs` re-uploaded jedes Bild durch Payloads API → Sharp generiert die fehlenden Varianten + updated `doc.sizes`.

CDN-Cache: Re-Uploads behalten dieselbe URL → CDN serviert die alte Version bis TTL. Manuell purgen.

### CDN serviert alte Version nach Re-Processing (Bunny / Cloudflare / etc.)
**Symptom:** `regenerate-image-sizes.mjs` oder `regenerate-video-posters.sh` lief erfolgreich, Origin liefert die neuen Bytes — Browser bekommt aber weiter die alte Version.
**Ursache:** CDN serviert URL-cached. Re-Generated Files behalten die URL.
**Fix:** Spezifische URL-Patterns im CDN-Dashboard purgen (Bunny: "Purge by URL"). Optional: Purge-API-Call ans Ende der Regen-Scripts hängen.

---

## CSS / Layout

### Tag-Swap zwischen `<h3>` und `<h5>` zeigt KEINEN visuellen Unterschied
**Symptom:** A11y-Audit verlangt einen heading-order-Fix (z.B. `<h5>` → `<h3>`); nach dem Tag-Swap zeigt die Page in DevTools / Visual-Diff null Veränderung. Vermutung: "der Fix hat nicht gegriffen". Tatsächlich hat er — er ist nur unsichtbar.
**Ursache:** Tailwind v4's Preflight resettet ALLE default-Heading-Größen. `<h1>`-`<h6>` haben dieselbe Computed-Size wie `<p>`, bis eine Tailwind-Utility das überschreibt. Wenn beide Tags dieselbe Utility-Class tragen (`text-3xl font-bold`), rendern sie identisch — der Tag-Wechsel ist eine reine Semantik-Änderung.
**Fix:** Akzeptieren, dass heading-order-Fixes oft Visual-Diff-frei sind. Verifikation via Lighthouse a11y oder Browser-DevTools "Accessibility Tree", nicht via Screenshot-Compare.
**Deep-Dive:** [LEARNINGS.md §12.6](LEARNINGS.md#126-a11y-ist-ein-schema-choice-kein-polish-sprint-am-ende).

### Lighthouse-Color-Contrast-Issues bei dekorativen Elementen
**Symptom:** Lighthouse meldet Contrast-Issues für absichtlich low-contrast Elemente — z.B. große graue Section-Nummern in `text-mute-2`, dekorative Trenn-Striche.
**Ursache:** Audit behandelt sie als Content. Sie sind aber visual rhythm, kein Lese-Material.
**Fix:** `aria-hidden="true"` auf das Element. Removed es aus dem Accessibility-Tree → Lighthouse hört auf zu meckern → Screenreader liest's nicht vor (was korrekt ist, weil Editor "07" oder "✦" nicht hören will).
**Anti-Pattern:** `display: none` — entfernt es auch visuell. `aria-hidden` hält es sichtbar aber semantisch unsichtbar.
**Deep-Dive:** [LEARNINGS.md §12.6](LEARNINGS.md#126-a11y-ist-ein-schema-choice-kein-polish-sprint-am-ende).

### Lighthouse-LCP "Regression" nach Deploy, die keine ist
**Symptom:** LCP war im Pre-Deploy-Run 2.8s, Post-Deploy 3.2s — "der letzte Change hat performance-regressed".
**Ursache:** Lighthouse-LCP variiert ±300–500ms zwischen Runs auf identischem Build (CDN-Cold-Cache, CPU-Throttling-Lottery, Bandwidth-Schwankung). Single-Run-Vergleich ist Mess-Noise, nicht Code-Regression.
**Fix:** Pre/Post-Deploy je 3+ Runs, gegen Median vergleichen. Bei <500ms-Differenz: keine Regression annehmen. Erst bei konsistentem Drift über 5+ Runs ist ein Code-Diff verdächtig.
**Deep-Dive:** [LEARNINGS.md §11.12](LEARNINGS.md#1112-lighthouse-noise-gegen-lcp-hetzerei-impfen).

### `position: sticky` funktioniert plötzlich nicht mehr
**Symptom:** Eine sticky Nav (oder andere `position: sticky`-Element) bleibt nicht mehr oben kleben — verhält sich wie `position: relative`.
**Ursache:** Ein Ancestor (typisch: `html`, `body`, oder ein Layout-Wrapper) hat `overflow: hidden`, `overflow-x: hidden`, oder `overflow-y: hidden`. Das erzeugt einen scroll-containing-block, sticky braucht aber den nächsten **scrollenden** Ancestor.
**Fix:** `overflow-x: clip` (oder `overflow: clip`) statt `hidden` benutzen. Visuell identisch, kein containing-block. Beide brauchen es: `html, body { overflow-x: clip }`.
**Browser-Support:** Chrome 90+, Safari 16+, Firefox 81+ (2026 unbedenklich).
**Deep-Dive:** [LEARNINGS.md §11.2](LEARNINGS.md#112-overflow-x-clip-nicht-hidden-auf-html-body).

### Mobile-Menü / Modal sitzt nach Scroll an der falschen Stelle
**Symptom:** Ein `position: fixed`-Element verhält sich wie `position: absolute` — sitzt nicht relativ zum Viewport sondern relativ zu einem Ancestor.
**Ursache:** Ein Ancestor hat `transform`, `filter`, `perspective`, oder `will-change` gesetzt → das macht ihn zum containing-block für `position: fixed`-Descendants.
**Fix:** Element via `createPortal(element, document.body)` aus dem Stacking-Kontext rausspielen. Siehe `MobileMenu.tsx` als Referenz.
**Deep-Dive:** [LEARNINGS.md §11.4](LEARNINGS.md#114-position-fixed-containing-block-falle).

### Mobile Modal lässt unten einen leeren Streifen frei (iOS Safari)
**Symptom:** Full-screen-Overlay mit `height: 100vh` sieht auf iOS am unteren Rand abgeschnitten aus, oder lässt einen Streifen Page-Content sichtbar.
**Ursache:** iOS Safaris einklappende URL-Bar verändert die Viewport-Höhe dynamisch. `100vh` ist die "größte mögliche" Höhe, nicht die aktuell sichtbare.
**Fix:** `height: 100dvh` benutzen (dynamic viewport height). Tracked die aktuell sichtbare Höhe inkl. Toolbar-State.
**Deep-Dive:** [LEARNINGS.md §11.3](LEARNINGS.md#113-100dvh-statt-100vh-für-full-viewport-overlays).

### Mobile-Menü zeigt darunter liegendes Page-Content "shimmer-through"
**Symptom:** Beim Öffnen des mobile Menüs scheinen Teile der Page (z.B. ein autoplay-Video im Hintergrund) durch.
**Ursache:** Das Overlay startet erst unterhalb des Headers (z.B. `top: 56px`); der Header ist semi-transparent und liegt darüber.
**Fix:** Overlay covered den **vollen Viewport** (`top: 0; height: 100dvh`). Damit der Close-Button erreichbar bleibt: einen In-Overlay-Close-Button rendern (siehe `MobileMenu.tsx`).

---

## Mail / Postmark

### Postmark sendet erste Wochen nur an Domain-eigene Empfänger
**Symptom:** Form-Submit oder Password-Reset gibt im API-Endpoint Success zurück, aber externe Lead-Adressen (`anna@kunde-xy.de`) bekommen nichts. Direkter API-Test gegen Postmark liefert `ErrorCode: 412, Message: "While your account is pending approval..."`. Domain-eigene Empfänger (z.B. `hello@<deine-domain>.com`) funktionieren.
**Ursache:** Anti-Abuse-Mechanismus. Frische Postmark-Accounts dürfen für die ersten Wochen nur an Adressen senden die zur From-Domain passen, bis Postmark den Use-Case manuell approved.
**Fix:** Postmark UI → oben rechts Avatar / Account → "Request Approval to Send" / "Apply for Approval". Form ausfüllen mit Use-Case (z.B. "Trade show service inquiries via website contact form, transactional only, no marketing"), erwartetem Volumen, Sender-Type. Approval kommt typisch innerhalb weniger Stunden bis 1 Tag. Sobald grün: alle Empfänger funktionieren.
**Workaround bis Approval da ist:** für Smoke-Tests an Domain-eigene Adressen senden (`hello@<domain>.com`, `info@<domain>.com`). Echte externe Form-Submissions werden in dieser Phase silent von Postmark gedroppt — Payload's Adapter swallowt den Error, der API-Endpoint returniert weiter Success.
**Deep-Dive:** [AGENCY-STACK.md — neuer Kunde aufsetzen](AGENCY-STACK.md#operations-pattern).

### Postmark-Server-SMTP wurde manuell deaktiviert
**Symptom:** Token + .env sind korrekt, API-Sends funktionieren (form-submit per SDK), aber alles was über Payload's nodemailer-Adapter läuft (= Password-Reset, Email-Verify, Magic-Link) failed mit `Invalid login: 535 5.7.8 Error: authentication failed`.
**Ursache:** SMTP ist auf dem Server **disabled**. Standardmäßig ist SMTP auf neuen Postmark-Servern **aktiviert**, aber jemand hat es bewusst ausgeschaltet (Attack-Surface-Argument, oder versehentlich beim Setup). Die API-Endpoints funktionieren regardless, aber der SMTP-Endpoint rejected jeden AUTH-Versuch.
**Fix:** Postmark UI → Server "Name" → **API** Tab → "Enable SMTP API" oder ähnlich beschrifteten Schalter wieder aktivieren. Token bleibt derselbe (Server-API-Token = SMTP-User UND SMTP-Pass). Direkt danach testen: `nodemailer.createTransport(...).verify()` sollte `verify ok` zurückgeben statt 535.
**Wann SMTP bewusst aus lassen:** wenn ihr Attack-Surface minimieren wollt + nichts SMTP-only braucht. Dann alle Payload-Auth-Flows per `disableEmail: true` + Custom-Endpoint auf die Postmark-API umstellen (mehr Code, aber single send mechanism). Pattern-Skizze in [POSTMARK-TEMPLATES.md — Payload Auth via API](POSTMARK-TEMPLATES.md#payload-auth-forgotpassword-mit-brand-template).

### `WARN: No email adapter provided` im pm2-Log
**Symptom:** Payload startet sauber, Form-Submits + Password-Reset werden im Log statt versendet ausgegeben. Warnung jedes Mal beim Start. ODER: keine WARN sichtbar, aber dennoch failt jeder Send mit 535 obwohl `.env` korrekt aussieht.
**Ursache (zwei Schichten):**
1. SMTP-Credentials in `.env` fehlen oder `SMTP_HOST=localhost` → der nodemailerAdapter aktiviert sich nicht (nimmt explizit "localhost" als Dev-Sentinel).
2. **`.env` korrekt aber pm2-Prozess sieht die Werte nicht.** Next.js' "auto-load `.env`" propagiert nicht zuverlässig durch pnpm + cross-env + pm2. Der gestartete Node-Prozess hat leere `process.env.SMTP_*`-Werte obwohl die Datei stimmt. Klassischer Symptom: `cat /proc/<PID>/environ | tr '\0' '\n' | grep SMTP_` returniert leer.
**Fix:** In Server-`.env` setzen, für Postmark:
```
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<Server-API-Token>
SMTP_PASS=<Server-API-Token>     ← gleicher Token, beide Felder
SMTP_FROM=noreply@<domain>
```
Plus: `set -a; source .env; set +a; pm2 restart <app> --update-env` — die `set -a` exportiert alle danach gesourceten Variablen, dann `--update-env` reicht sie an den restart-Prozess durch. Reines `pm2 restart --update-env` ohne shell-source greift NICHT zuverlässig.
Im Template ist das fest in `scripts/deploy.sh` verdrahtet vor jedem `pm2 restart`. Bei manuellen Restarts dran denken.
**Deep-Dive:** [AGENCY-STACK.md — Payload-Integration](AGENCY-STACK.md#payload-integration).

### Postmark-SMTP `535 Authentication failed`
**Symptom:** Nach Setup obiger Config: pm2-Logs zeigen `Invalid login: 535 SMTP authentication failed` bei jedem sendEmail.
**Ursache (häufigste):** `SMTP_USER` oder `SMTP_PASS` haben Whitespace oder enthalten den Account-API-Token statt den Server-API-Token. Die zwei Tokens sehen ähnlich aus aber haben verschiedene Scopes.
**Fix:** Token aus dem Postmark-UI **Server**-Bereich neu kopieren (`Servers → <name> → API Tokens → Server API Token`). NICHT der Account-API-Token oben rechts unter dem Account-Menu — der hat andere Permissions und kann nicht senden.
**Deep-Dive:** [POSTMARK-TEMPLATES.md — Sync-Script](POSTMARK-TEMPLATES.md#sync-script) erklärt die Token-Hierarchie.

### Postmark-API gibt 422 statt 404 für fehlende Templates
**Symptom:** Beim Push eines Templates per API/Script: `GET /templates/{alias}` returniert 422 statt 404, das Sync-Script interpretiert das als Error statt als "noch nicht angelegt".
**Ursache:** Postmark-Konvention. Viele "not found"-Cases kommen als 422 mit ErrorCode-Detail zurück.
**Fix:** Im Sync-Script BEIDE Status-Codes (404 + 422) als "doesn't exist yet, create" behandeln. Das mitgelieferte `scripts/sync-postmark-templates.mjs` macht das so.

### Postmark-CLI ignoriert Layouts
**Symptom:** `postmark-cli push` läuft durch, aber das Layout-File aus dem Repo landet nicht im Postmark-UI als Layout — nur die Templates kommen an. Templates die `LayoutTemplate: <alias>` referenzieren rejected dann mit 422.
**Ursache:** Die offizielle Postmark-CLI unterstützt nur Standard-Templates, keine Layouts. Layouts brauchen einen direkten API-Call.
**Fix:** Custom-Sync-Script (siehe `scripts/sync-postmark-templates.mjs`). Layouts müssen VOR Templates gepusht werden, sonst bricht die Layout-Referenz im ersten Template-Push.
**Deep-Dive:** [POSTMARK-TEMPLATES.md — Sync-Script](POSTMARK-TEMPLATES.md#sync-script).

### Postmark-UI Preview rendert beide Sprachen gleichzeitig
**Symptom:** Bilingual Template mit `{{#de}}…{{/de}}{{#en}}…{{/en}}`. Im Postmark-UI Preview-Tab werden BEIDE Sections gerendert, das Editor-Team sieht Mischmasch und denkt das Template ist kaputt.
**Ursache:** Ohne TemplateModel rendert Mustachio im Postmark-UI alle Sections als truthy (default empty model). Erst mit explizit gesetztem Model wird der Branch gewählt.
**Fix:** Inverted-Section-Pattern statt zwei separate Sections. Eine Sprache als Default (rendert wenn die Variable NICHT gesetzt ist), die andere als override:
```mustache
{{#de}}German{{/de}}{{^de}}English (default){{/de}}
```
Im Preview ohne Model rendert nur die Default-Sprache. Im Live-Send setzt App-Code `{de: true}` für deutsche Locale.
**Deep-Dive:** [POSTMARK-TEMPLATES.md — Mustachio-Patterns](POSTMARK-TEMPLATES.md#mustachio-patterns).

### Email-Button rendert ohne Text in Outlook
**Symptom:** Inline-block-styled-anchor als Button (`<a style="display:inline-block; bg-color:...">Click</a>`). Im Browser-Preview perfekt; in Outlook-Desktop / einigen Webmails: schwarze Pille ohne sichtbaren Text, oder reiner Text-Link ohne BG.
**Ursache:** Outlook ignoriert manche inline `display`/`background-color` CSS-Werte je nach Version. Webmails überschreiben Anchor-Color.
**Fix:** Bulletproof-Button-Pattern (Tabelle + bgcolor-Attribut + span um Text):
```html
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td bgcolor="#1A1A1A" style="background-color:#1A1A1A;border-radius:999px;">
      <a href="..." style="display:inline-block;padding:14px 28px;color:#F5F2ED;text-decoration:none;">
        <span style="color:#F5F2ED;">Button text</span>
      </a>
    </td>
  </tr>
</table>
```
**Deep-Dive:** [POSTMARK-TEMPLATES.md — Bulletproof Button](POSTMARK-TEMPLATES.md#bulletproof-button-table-based).

### SPF: zwei `v=spf1` Records koexistieren
**Symptom:** Postmark-Verification meldet "SPF record found but invalid" oder Mail-Provider rejected mit `permerror`.
**Ursache:** Mehrere TXT-Records auf der Apex-Domain die mit `v=spf1` anfangen. SPF-Spec sagt: maximal EIN gültiger Record pro Domain. Sobald zwei vorhanden, ist die ganze SPF-Auflösung ungültig.
**Fix:** Alle SPF-Includes in einem einzigen Record konsolidieren:
```
TXT  @  v=spf1 include:spf.protection.outlook.com include:spf.mtasv.net ~all
```
Achtung Lookup-Limit: SPF erlaubt maximal 10 DNS-Lookups insgesamt (rekursiv). M365-Include braucht ~3, Postmark 1.

### Mail kommt an, landet aber im Spam (frischer Domain-Setup)
**Symptom:** DKIM grün im Postmark-UI, SPF korrekt, Test-Mail ankommt im Gmail-Spam-Folder.
**Ursache-Kandidaten:** (1) Domain hat keine Sending-Reputation, neue Domain → erste Wochen erhöhte Spam-Klassifizierung, (2) DMARC-Record fehlt, (3) Empfänger-Provider hat strikte Filter.
**Fix:**
1. DMARC-Record setzen (siehe oben), beginnt mit `p=none` (report-only), nach 2-4 Wochen sauberen DMARC-Reports auf `p=quarantine`
2. Erste Wochen low volume halten (Reputation-Warmup)
3. Bei wichtigen Empfängern (B2B, Trade Show contacts) initial vorbeschicken: kurze persönliche Mail vom From-Account, damit der Empfänger sie als "expected sender" markiert

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

### 1Password-SSH-Auth funktioniert nur mit Host-Alias, nicht mit direkter IP
**Symptom:** `ssh root@1.2.3.4` → `Permission denied (publickey,password)`. `ssh projektname` (mit Config-Alias) → funktioniert sofort. Deploy-Scripts mit hardcoded IP brechen daher beim ersten `rsync`/`ssh` ab.
**Ursache:** Die SSH-Config-Blöcke `Host projektname` setzen den `IdentityFile`-Pointer auf den Public-Key, den der 1P-Agent in einen Private-Key auflöst. Bei direkter IP matcht kein `Host`-Block → kein `IdentityFile` → 1P wird nicht abgefragt → Auth schlägt fehl.
**Fix:** Deploy-Scripts müssen den Host-Alias nutzen, nicht die IP. `DEPLOY_HOST` als Env-Var konfigurierbar machen mit dem Alias als Default:
```bash
HOST="${DEPLOY_HOST:-projektname}"
```
**Anti-Pattern:** `HOST="root@1.2.3.4"` als Default — funktioniert nur ohne 1P-Agent (also nur lokal mit Plain-Key auf Disk, nicht im Standard-Setup).

### Zombie-Node-Prozess hält Port 3000 nach abgebrochenem Build/Deploy
**Symptom:** PM2 startet, crasht sofort, geht in Restart-Loop. `pm2 logs` zeigt:
```
Error: listen EADDRINUSE: address already in use :::3000
```
Status zyklisch `online → errored → online`, Restart-Counter steigt schnell.
**Ursache:** Ein vorheriger Build-Abbruch (z.B. SIGKILL durch OOM oder unterbrochener Deploy) hat einen detached Next.js-Worker hinterlassen, der den Port blockiert. PM2 weiß nichts von dem Zombie und kann ihn nicht selbst killen.
**Fix:**
```bash
# 1. Finde den Zombie:
ss -tlnp | grep ':3000'   # PID in Spalte "users:"
# 2. Kill direkt:
kill -9 <pid>
# 3. PM2 sauber neu starten (NICHT pm2 reset — das kippt den Prozess in errored):
pm2 stop <app>
pm2 start ecosystem.config.cjs
pm2 save
```
**Verwandt:** `pm2 reset <app>` setzt zwar den Restart-Counter zurück, kann aber bei aktiven Prozessen den Status auf `errored` kippen — bei laufenden Apps lieber gar nicht aufrufen oder erst stoppen.

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
