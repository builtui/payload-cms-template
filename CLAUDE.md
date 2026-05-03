# Payload CMS Module Template

Modular Payload CMS + Next.js template mit Wrapper/Container-Architektur. Basis für content-getriebene Websites mit editor-freundlichem Block-System, DSGVO-Compliance und Live-Deployment auf Hetzner Cloud.

**Diese Datei wird automatisch in jeden Session-Kontext geladen.** Halte sie knapp — Details in den spezialisierten Docs unter `docs/`.

---

## Where to find info

**Kurzer Entscheidungs-Guide bevor du was liest:**

| Frage | Datei |
|---|---|
| "Wie mache ich X beim Aufsetzen eines neuen Projekts?" | [docs/NEW-PROJECT.md](docs/NEW-PROJECT.md) — Step-by-Step |
| "Ich habe einen konkreten Fehler / 502 / Build-Crash / DB-Error" | [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md) — Quick-Lookup |
| "Wie deploye ich auf einen Hetzner-Server?" | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — komplettes Playbook |
| "Warum machen wir X so und nicht anders?" | [docs/LEARNINGS.md](docs/LEARNINGS.md) — Entscheidungen + Gründe |
| "Welche Features gibt es im Template und welche sind opt-in?" | [docs/FEATURES.md](docs/FEATURES.md) |
| "Welche Projekte nutzen das Template schon?" | [docs/PROJECTS.md](docs/PROJECTS.md) |
| "Ist mein Server production-ready?" | [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) |

**Schneller Code-Einstieg:**
- `src/blocks/` — Block-Schemas (Payload-Fields)
- `src/components/blocks/` — Block-Render-Components (React)
- `src/collections/` — Content-Types
- `src/globals/` — Singletons (SiteSettings, Navigation, Footer, …)
- `src/fields/` — reusable Field-Helpers (`linkField`, `slugField`, `wrapperFields`)
- `src/lib/` — Helpers (`mergeLocalized`, `resolveLink`, …)
- `src/app/(frontend)/` — Public Routes + `globals.css`
- `src/app/(payload)/` — Admin Panel (auto-generated, **nicht editieren**)
- `src/payload.config.ts` — Zentrale Config

**Referenz-Projekte** (Source of Truth für "wie wurde das schon mal gelöst"):
- `/Users/bugbox/dev/ludwigmoeller/payload/` — Docker+Caddy, Portfolio-Site, Video-Transcoding
- `/Users/bugbox/dev/hugenottenhaus/payload/` — Event-Registration + Email
- `/Users/bugbox/dev/xrealities/booth2content/cms/` — PM2/systemd-Deployment, i18n URL-Segmente, Package-Configurator

Siehe [docs/PROJECTS.md](docs/PROJECTS.md) für Details.

---

## Tech Stack

- **CMS:** Payload v3 + Lexical Rich Text
- **Frontend:** Next.js 16 App Router + React 19
- **Styling:** Tailwind CSS v4 (Preflight active)
- **Database:** PostgreSQL 16 via `@payloadcms/db-postgres`
- **Images:** Sharp (auto WebP conversion, quality 82, responsive sizes)
- **SEO:** `@payloadcms/plugin-seo`
- **i18n:** DE (default) + EN with fallback
- **Node:** 18.20.2+ / 20.9+ (empfohlen 22)
- **Package Manager:** pnpm 9+/10

---

## Core Architecture

### Wrapper/Container System
Jeder Block nutzt `BlockWrapper`:
```
<section>           ← full-width (background colors go here)
  <div class="edge"> ← content-width (16/32/48px responsive padding)
    [dividerTop]     ← optional border-t border-deep-black
    [content]
    [dividerBottom]  ← optional border-b
  </div>
</section>
```
- Module sitzen 0px auseinander. Abstand kommt EXKLUSIV aus `paddingTop`/`paddingBottom` innerhalb des Wrappers.
- `paddingTop`/`paddingBottom` separat steuerbar pro Block.
- `dividerTop`/`dividerBottom` optionale Checkboxes.
- `background`: `transparent`, `warm-white`, `deep-black`.
- `hidden`: Editor kann Block deaktivieren ohne zu löschen (siehe [FEATURES.md](docs/FEATURES.md)).

### Block Numbering
Blocks nutzen concept-number slugs: `m1-page-title`, `m2-hero`, `m3-text-image-split`.
Labels im Admin: `M3 Text-Bild Split`. **Blocks sind NICHT im Template enthalten** — baue sie pro Projekt. Gemeinsame Sprache zwischen Design-Konzept, CMS-Admin und Code.

### Smart Link System
`linkField()` erzeugt einen Radio-Toggle (Internal/External):
- **Internal**: Relationship-Dropdown (select a page/event/artist) — kein manuelles Slug-Tippen
- **External**: URL-Field + "open in new tab" checkbox
- `SmartLink`-Component wählt Icon automatisch: `ArrowRight →` für Internal, `ArrowUpRight ↗` für External
- `COLLECTION_PATHS` in `SmartLink.tsx` definiert URL-Präfixe pro Collection

### Image / Media Handling
- Payload auto-generiert: `thumbnail` (400×300, cropped), `card` (768×576, cropped), plus aspect-preserving `small-w` (800), `medium-w` (1280), `hero` (1920)
- `formatOptions: { format: 'webp', quality: 82 }` konvertiert alle Uploads zu WebP
- `PayloadImage` rendert ein nacktes `<img>` mit Sharp-srcset, geht direkt über CDN — Next.js Image-Optimizer wird übersprungen. Trade-offs siehe [LEARNINGS.md §11.7](docs/LEARNINGS.md#117-direct-cdn-payloadimage-skip-nextjs-image-optimizer).
- IMMER `PayloadImage` / `PayloadMedia` in einem Container mit `className="relative"` + aspect-ratio + `overflow-hidden` verwenden
- `sizes` prop explizit setzen: `"(min-width: 768px) 58vw, 100vw"` für 7/12-Col-Blocks
- **`<PayloadMedia>` statt `<PayloadImage>` benutzen, wenn das Field auch Video sein kann** — auto-pickt nach mimeType. Companion: `isVideoMedia(media)`.
- Media-Collection benutzt Payloads native Folders (`folders: true`) für Organisation — keine hardcoded `folder`-Select-Felder mehr.
- CDN-Host via `NEXT_PUBLIC_MEDIA_CDN_URL` env. Empty = Origin-Serving (lokale Dev).

### Performance (ISR/SSG)
- Alle Pages `export const revalidate = 60` — static cache, regeneriert alle 60 Sekunden
- Dynamische `[slug]`-Routes nutzen `generateStaticParams` zum Pre-Render bei Build
- Neue Pages nach Build → on-demand generiert beim ersten Visit, dann gecached
- `next.config.ts` → `images.remotePatterns` für Payload-Media-URLs konfiguriert

**KRITISCH — `generateStaticParams` MUSS in try/catch:**
```tsx
export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const pages = await payload.find({ collection: 'pages', limit: 100 })
    return pages.docs.map((p: any) => ({ slug: p.slug }))
  } catch {
    // DB nicht erreichbar beim Build → Fallback auf on-demand generation
    return []
  }
}
```
Ohne das bricht `pnpm build` wenn DB in CI unreachable. Mit dem Fallback generiert Next.js die Pages on-demand beim ersten Request. Siehe [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md).

### Slug Handling
Helper `slugField('title')` in `src/fields/slugField.ts` generiert URL-safe Slugs via `slugify()`:
- Deutsche Umlaute: `ö → oe`, `ä → ae`, `ü → ue`, `ß → ss`
- Akzente entfernt: `á → a`, `ñ → n`
- Lowercase, Sonderzeichen → Bindestrich
- Läuft als `beforeValidate`-Hook → feuert VOR Unique-Check

### Taxonomy Pattern (editor-managed tags)
Für Kategorien/Tags, die Editoren managen sollen (add, rename, delete): **separate Collection** mit Relationship-Field, NICHT static `select`.

```typescript
// 1. Taxonomy-Collection
export const EventTypes: CollectionConfig = {
  slug: 'event-types',
  admin: { useAsTitle: 'name', group: 'Einstellungen' },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
  ],
}

// 2. Referenzieren mit hasMany für multi-select
{ name: 'types', type: 'relationship', relationTo: 'event-types', hasMany: true }
```
Warum: Static `select` bräuchte Code-Changes für Option-Add/Rename. Mit Relationship managen Editoren die Categories im Admin.

### SEO Files (robots.txt + sitemap.xml)
- `src/app/robots.ts` und `src/app/sitemap.ts` nutzen Next.js' Metadata-Route-Konvention
- MÜSSEN in `src/app/` direkt liegen — **NICHT** in `(frontend)/` Route-Group (Next.js ignoriert Route-Groups für Metadata-Files)
- `robots.ts` blockt `/admin` und `/api`
- `sitemap.ts` queried DB, generiert Entries pro Collection
- Beide nutzen `NEXT_PUBLIC_SITE_URL` env — auf Production-Domain setzen

---

## Key Rules — Code

### Build (Next.js 16)
Production-Build wird mit `--webpack` gepinnt (siehe `package.json`). Turbopack-Prod ist in Next 16 instabil — generiert intermittent kein `pages-manifest.json`, meldet aber "Compiled successfully". Rationale + Re-Eval-Trigger: [LEARNINGS.md §11.1](docs/LEARNINGS.md#111-nextjs-16-webpack-pinnen-turbopack-prod-ist-instabil).

### Deployment
`scripts/deploy.sh` ist die Referenz. Configurable via env (`APP_NAME`, `REPO_DIR`, `BRANCH`, `SMOKE_URL`). NIEMALS `pnpm build && pm2 restart` chainen (tail-masks-exit-code-Falle), niemals nested `ssh + sudo + bash -c "..."` mit Quote-Escaping (`$?` wird vom OUTER Shell expandiert). Beide Anti-Patterns dokumentiert in [DEPLOYMENT.md](docs/DEPLOYMENT.md#updates-deployen--scripted-empfohlen).

### Currency formatting (locale-aware)
Niemals manuell Tausender-Trenner einfügen. `formatCurrency(value, locale)` aus `src/lib/formatCurrency.ts` benutzen — `Intl.NumberFormat` macht Separator + Symbol-Position automatisch (`de-DE` → `1.500 €`, `en-GB` → `€1,500`, `de-CH` → `CHF 1’500`). Neue Märkte: eine Zeile in `LOCALE_MAP`.

### Tailwind CSS v4 + Preflight
- Preflight setzt `margin: 0` auf ALLEN Elementen. **Nie** auf Browser-Defaults verlassen.
- **NIEMALS** `margin: revert` auf `*` — zerstört Layouts.
- Utility-Classes (`mb-8`, `pt-4`) überschreiben Preflight weil `@layer utilities` > `@layer base`.
- Wenn eine Tailwind-Class nicht greift → prüfen, ob sie im compiled CSS existiert (Content Detection).
- **`overflow-x: clip` (NICHT `hidden`) auf `html, body`** für no-horizontal-scroll. `hidden` erzeugt einen scroll-containing-block, der `position: sticky` in jedem Descendant bricht. Siehe [LEARNINGS.md §11.2](docs/LEARNINGS.md#112-overflow-x-clip-nicht-hidden-auf-html-body).

### Section Labels
Immer `mb-6 md:mb-8` für Section-Labels (konsistent mit Prototype). Keine Sonderlösungen.

### Payload Version Matching
ALLE `@payloadcms/*` Packages MÜSSEN die gleiche Version haben. Payload checkt das beim Startup — bei Mismatch failed's mit eindeutiger Fehlermeldung.

### Mobile Menu
Via `createPortal(element, document.body)` gerendert — wegen zwei Fallen:
- Stacking-Context des Headers (`z-50`) entkommen
- `position: fixed` Containing-Block-Falle (jeder Ancestor mit `transform`, `filter`, `perspective`, `will-change` re-anchored fixed-Children)

Full-Viewport-Overlay: `top: 0; height: 100dvh` (NICHT `100vh` — iOS Safari's einklappende Toolbar lässt `100vh` überschiessen). Header bleibt unter dem Overlay → In-Overlay-Close-Button rendern. Siehe `MobileMenu.tsx`.

### Server vs Client Components
- **Server Components** (async, default): Event-Lists, Project-Cards, Artist-Features — queryen DB direkt
- **Client Components** (`'use client'`): MobileMenu, CookieBanner, VideoEmbed, Navigation-Interactions

Client-Components mit `useSearchParams()` brauchen `<Suspense>` Wrapper, sonst bricht Build bei SSG.

### GDPR (DSGVO)
- Cookie Banner: 4 Kategorien (Necessary, Analytics, Marketing, External Media)
- YouTube: `youtube-nocookie.com`; Vimeo: `dnt=1`
- Video Consent Gate: 3 States (no consent → placeholder, consent → poster+play, active → iframe)
- Fonts + Icons self-hosted (no CDN)
- "Load video once" = single consent (GDPR Art. 6 Abs. 1a)
- **Tracking-Vertrag**: Banner und Tracker kommunizieren ausschliesslich über das `cookie-consent-update` CustomEvent + `localStorage['cookie-consent']`. Niemals direkten Banner-Import in Tracker-Components — neuer Tracker = neuer Listener, nicht Banner-Anpassung. Default-Tracker: `<Analytics id={siteSettings.analyticsId} />` aus `src/components/Analytics.tsx` (GA4, voll consent-gated). Siehe [LEARNINGS.md §12.5](docs/LEARNINGS.md#125-tracking-consent-als-event-vertrag-nicht-als-if-chain).

### Locale aus params (nicht aus headers())
Wenn URL-Segmente-i18n aktiv ist: Locale IMMER aus `params` lesen, an jede Component durchreichen. `currentLocale()` via `headers()` macht alle Pages dynamic → kein ISR.

### Localized Array Updates (Payload-Quirk)
Niemals `p.update({ locale: 'de', data: { arr: [...] } })` ohne Item-IDs — überschreibt die anderen Locales. Immer über `mergeLocalized` / `mergeLayout` Helper gehen. Siehe [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md).

---

## Commands

```bash
pnpm dev                  # Dev server
pnpm build                # Production build
pnpm seed                 # Seed database (ALLOW_SEED=true für Safety)
pnpm generate:importmap   # Nach Block-/Admin-Component-Änderungen ZWINGEND
pnpm generate:types       # TypeScript-Types aus Payload-Schema
pnpm lint                 # ESLint

# Migrations (production)
pnpm payload migrate:create <name>  # Diff-SQL generieren (interaktiv)
pnpm payload migrate                # Migrationen anwenden

# Kompletter Reset (lokal!):
rm -rf media/ && psql -d DB_NAME -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" && ALLOW_SEED=true pnpm seed
```

**Routine nach Schema-Change:**
1. `pnpm payload migrate:create <name>` (interaktiv)
2. `pnpm payload migrate` (apply)
3. Wenn Custom-Admin-Component angefasst: `pnpm generate:importmap`
4. `pnpm generate:types`

---

## Before doing X

| Aktion | Was vorher checken |
|---|---|
| Neuen Block bauen | Wrapper-System nutzen (`makeWrapperFields`), in passender Block-Liste registrieren (`allBlocks`, `detailBlocks`, `blogBlocks`). Silent-Drop-Gotcha in [KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md). |
| Neue Collection anlegen | `useAsTitle`, `defaultColumns`, `admin.group` setzen. `listSearchableFields` NUR Text-Fields. |
| Localized Array-Update | `mergeLocalized`-Helper. Niemals raw `p.update({ locale: 'de' })`. |
| Blocks in mehreren Collections | In JEDE Block-Liste eintragen. |
| Custom Admin-Component | `pnpm generate:importmap` danach. |
| Schema-Change auf Prod | `pnpm payload migrate:create <name>` (nicht `db.push`). |
| Deploy | `scripts/deploy.sh` benutzen — niemals `pnpm build && pm2 restart` chainen, niemals nested `ssh + bash -c "..."`. Für selektives Cache-Preserving: `.next/{server,static,types,build-manifest.json,app-build-manifest.json}` löschen, NICHT ganzer `.next`-Ordner. |
| Neue Sharp-`imageSize` ergänzen | DB-Migration für die neuen Spalten erstellen + `scripts/regenerate-image-sizes.mjs` für Alt-Uploads laufen lassen + CDN-URLs für die Variante purgen. |
| Video-Poster-Encoding ändern | `scripts/regenerate-video-posters.sh` für Alt-Uploads laufen lassen + CDN-Pattern `*-poster.webp` purgen. |
| Neue Collection mit Live Preview | `payload.config.ts → livePreview.url` mapping ergänzen. |
| Pre-Launch → Go-Live | [SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) durchlaufen. Basic Auth + X-Robots-Tag raus. |
| Neues Referenz-Projekt abgeleitet | Eintrag in [PROJECTS.md](docs/PROJECTS.md) nachtragen. |

---

## File Structure
```
src/
├── blocks/              # Block SCHEMA (Payload fields)
├── fields/              # Reusable: wrapperFields, linkField, slugField
├── collections/         # Collection configs (Pages, Media, Users, …)
├── globals/             # Global configs (SiteSettings, Navigation, Footer)
├── components/
│   ├── blocks/          # Block RENDER components (React/TSX)
│   ├── icons/           # SVG icons (ArrowRight, ArrowUpRight)
│   ├── BlockWrapper.tsx
│   ├── RenderBlocks.tsx # blockType → Component mapping
│   ├── SmartLink.tsx
│   ├── PayloadImage.tsx
│   ├── CookieBanner.tsx
│   └── RichText.tsx
├── lib/                 # Helpers (mergeLocalized, resolveLink, …)
├── admin/               # Custom admin components (BlockRowLabel)
├── app/
│   ├── (frontend)/      # Public routes + globals.css
│   └── (payload)/       # Admin (auto-generated — nicht editieren)
├── payload.config.ts
├── middleware.example.ts   # Opt-in i18n URL-Segmente
└── seed.example.ts         # Copy → seed.ts pro Projekt
```

---

## Production Checklist (Kurzfassung)

Siehe [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) + [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) für Details.

- [ ] Starker `PAYLOAD_SECRET`: `openssl rand -hex 32`
- [ ] `DATABASE_URL` mit prod-Credentials
- [ ] `NEXT_PUBLIC_SITE_URL` auf canonical Production-URL
- [ ] Prod-Domain in `images.remotePatterns`
- [ ] Migrations erstellt + applied (nicht `db.push` in Prod)
- [ ] ffmpeg installiert wenn Video-Collection
- [ ] `pnpm build` läuft clean
- [ ] nginx + SSL + security headers
- [ ] fail2ban, DB-Backup-Cron
- [ ] Image pre-warming via `pnpm prewarm`
- [ ] Basic Auth pre-launch aktiv (bis Go-Live)

---

## Working Principles (Boothside-Session 2026)

Diese Prinzipien stehen ÜBER dem konkreten Code — sie gelten für jedes
nächste Projekt. Detail-Erklärungen + Beispiele in [LEARNINGS.md §12](docs/LEARNINGS.md#12-module-bau-übersetzbarkeit-tracking--prinzipien).

### Pflegbarkeit
- **Was Editor sehen können muss, lebt im CMS.** Hardcoded Strings in Route-Wrappern sind Schulden. Archive-Pages, Footer-Spalten, CTAs, Section-Labels → alles Felder.
- **One Element, One Source.** Wenn der User EIN UI-Element sieht (= "der Footer"), bekommt der Editor EIN Feld dafür (oder ein Array). Verteilung über drei Globals ist Architektur-Bequemlichkeit, die der Editor bezahlt.
- **Schema-Description in der Sprache des Editors.** Code-Identifier dürfen englisch bleiben, der `description`-String spart 80% der Editor-Rückfragen.

### Übersetzbarkeit (von Tag 1)
- **Jedes Editor-Text-Field bekommt `localized: true`** — auch wenn nur eine Sprache aktiv ist. Kosten: ein Bool. Ersparnis: keine `_locales`-Migration über existierende Daten.
- **`fallback: true` + `defaultLocale`** — DE-leere Felder rendern EN, statt während Übersetzung leer zu bleiben.
- **Locale aus `params`, NIEMALS `headers()`** (sonst kein SSG, siehe [§3](docs/LEARNINGS.md#3-i18n--lokalisierung)).
- **Layout-Updates pro Locale via `mergeLocalized`** — sonst killt DE-Save die EN-Items.
- **`formatCurrency(value, locale)`** statt `toLocaleString()` + manuell €/CHF reinfrickeln.

### Block-Bau (Wrapper als Vertrag)
- **0px zwischen Blocks** — Spacing ausschliesslich aus `paddingTop`/`paddingBottom` im Wrapper. Niemals `mt-12` auf dem ersten Element im Block-Inneren.
- **Background nur am Wrapper**, nicht am Content-Container.
- **Block in ALLE relevanten Block-Listen** (`allBlocks`/`detailBlocks`/`blogBlocks`) eintragen, sonst silent-Drop beim Seed.
- **Block-Numbering als shared language**: `m1-page-title`, `m15-image-video-split` — Design ↔ Admin ↔ Code sprechen dieselbe Sprache.
- **`wrapper.hidden` statt Delete** für deaktivierbare Module.
- **Layout-Felder am Block, nicht in der Page** — Editor justiert pro Instanz.

### A11y im Schema, nicht am Ende
- **Heading-Order semantisch, nicht visuell.** Tailwind v4 Preflight macht alle h1–h6 visuell gleich → Tag-Swaps sind reine A11y-Fixes ohne visual diff.
- **Decorative Elemente via `aria-hidden="true"`**, NICHT `display: none` (graue Section-Nummern, dekorative Trenn-Striche).
- **`alt`-Field required + localized** auf Media-Collections — 5s Editor-Friction vs. ein Audit-Issue.

### Arbeitsweise
- **Root-Cause vor Workaround.** Wenn der Fix den Mechanismus nicht erklären kann, ist es ein Workaround. Workaround-explizit-markieren (Code-Comment + Re-Eval-Trigger), niemals als regulären Code tarnen.
- **Scope-Disziplin.** Nur was gefragt wurde. Adjacent-Cleanup wandert in eine separate Notiz / Spawn-Task, nicht in den aktuellen Diff.
- **Mess-Noise einrechnen.** Lighthouse / TTFB / Bundle-Size: Median aus 3+ Runs. Single-Run-Vergleich ist Lottogeld.

---

## Pflege dieses Templates

- Neues Gotcha entdeckt? → Quick-Lookup in [KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md), Background in [LEARNINGS.md](docs/LEARNINGS.md)
- Neues Pattern in 2+ Projekten bewährt? → ins Template kopieren, [FEATURES.md](docs/FEATURES.md) + [PROJECTS.md](docs/PROJECTS.md) aktualisieren
- Neue Deployment-Erfahrung? → [DEPLOYMENT.md](docs/DEPLOYMENT.md) ergänzen
- Neues Projekt auf Template-Basis live? → Eintrag in [PROJECTS.md](docs/PROJECTS.md)
