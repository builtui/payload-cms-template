# Features

Was dieses Template mitbringt und was **aus den abgeleiteten Projekten** als Pattern verfügbar ist, wenn man's braucht.

Siehe auch:
- [PROJECTS.md](PROJECTS.md) — welches Projekt welche Features live hat
- [NEW-PROJECT.md](NEW-PROJECT.md) — wie man ein neues Projekt aus dem Template ableitet
- [LEARNINGS.md](LEARNINGS.md) — Hintergründe und Entscheidungsgründe pro Pattern

---

## Core — in jedem Projekt aus dem Template

Diese Features sind **aktiv, sobald man das Template klont**. Keine Aktivierung nötig.

### Stack
- **Payload CMS** v3.81+ — Headless CMS mit Admin-UI
- **Next.js** 16+ App Router — React Meta-Framework
- **React** 19 — Server Components + Client Components
- **PostgreSQL** 16 — via `@payloadcms/db-postgres`
- **Tailwind CSS** v4 — Utility-first, Preflight aktiv
- **Sharp** — Image-Processing (WebP auto-conversion, responsive Sizes)
- **Lexical** — Rich-Text-Editor (`@payloadcms/richtext-lexical`)
- **SEO-Plugin** — `@payloadcms/plugin-seo` (Meta-Tags, Sitemap-Integration)
- **pnpm** 9+/10 — Package-Manager
- **Node** 18.20.2+ / 20.9+ (empfohlen 22)
- **TypeScript** 5.7 strict

### Wrapper / Container Architecture
Jeder Block ist in `BlockWrapper` eingebettet:
```
<section>           ← full-width (background colors)
  <div class="edge"> ← content-width (16/32/48px responsive padding)
    [dividerTop]
    [content]
    [dividerBottom]
  </div>
</section>
```
- Module haben **0px Abstand zueinander**; Spacing kommt aus `paddingTop`/`paddingBottom` pro Wrapper
- Background pro Block: `transparent`, `warm-white`, `deep-black`
- `dividerTop`/`dividerBottom`: optionale Trennlinien

Helper: `makeWrapperFields(defaults)` generiert die Wrapper-Group pro Block.
Default-Wrapper-Felder: `paddingTop`, `paddingBottom`, `background`, `dividerTop`, `dividerBottom`, `hidden`.

### Smart Links (`linkField`)
`linkField()` liefert pro Feld einen Intern/Extern-Switch:
- **Intern** → Relationship-Dropdown (pages/events/artists/…). Kein manuelles Slug-Tippen.
- **Extern** → URL-Text + "Open in new tab"-Checkbox.

`SmartLink`-Komponente rendert mit passendem Icon:
- `ArrowRight →` für interne Links
- `ArrowUpRight ↗` für externe Links

`COLLECTION_PATHS` in `SmartLink.tsx` mappt Slugs auf URL-Präfixe (`pages → ''`, `events → /programm/`, etc.).

### Slug-Handling mit Umlauten
`slugField('title')` generiert via `beforeValidate`-Hook automatisch einen URL-safen Slug:
- Deutsche Umlaute: `ö → oe`, `ä → ae`, `ü → ue`, `ß → ss`
- Akzente: `á → a`, `ñ → n`, `ç → c`
- Lowercase, Sonderzeichen → Bindestrich, Kollaps mehrfacher Bindestriche
- Läuft VOR dem Unique-Check

### Media / Bilder
- Auto-Konvertierung zu **WebP** (Quality 82)
- Responsive Sizes: `thumbnail` (400×300), `card` (768×576), `hero` (1920px)
- `PayloadImage`-Component wrapped Next.js `<Image fill>` mit srcset + sizes
- `folder`-Feld für Organisation

### Performance / SSG + ISR
- Alle Routes `export const revalidate = 60` — 60s ISR-Cache
- `generateStaticParams` mit **try/catch-Fallback** (kritisch für CI-Builds ohne DB)
- Next.js-Image-Optimizer mit 30-Tage-Cache + reduzierten `deviceSizes`
- `experimental.inlineCss` — kritisches CSS inline

### SEO-Files
- `src/app/robots.ts` — Blockt `/admin` + `/api`
- `src/app/sitemap.ts` — Queried DB, generiert Entries pro Collection
- **WICHTIG:** beide in `src/app/` direkt, NICHT in `(frontend)/` (Next.js ignoriert Route-Groups für Metadata-Files)

### GDPR-Basics
- **Cookie Banner** (4 Kategorien: Necessary / Analytics / Marketing / External Media)
- **Video-Consent-Gate** (3 States: no consent → placeholder, consent → poster+play, active → iframe)
- YouTube: `youtube-nocookie.com`, Vimeo: `dnt=1`
- Self-hosted Fonts (kein CDN)
- **Tracking-Consent-Vertrag**: Banner dispatcht `cookie-consent-update` CustomEvent, Tracker subscriben → Banner und Tracker decoupled. Neuer Tracker = nur ein neuer Listener, keine Banner-Änderung. Siehe [LEARNINGS.md §12.5](LEARNINGS.md#125-tracking-consent-als-event-vertrag-nicht-als-if-chain).

### i18n (Basis-Config)
- `localization.locales`: EN + DE, default DE, `fallback: true`
- Alle Text-Felder in Collections mit `localized: true` markierbar
- Admin rendert Sprach-Switcher

---

## Opt-in-Features im Template

Diese Files liegen im Template, aber du entscheidest pro Projekt, ob du sie aktivierst.

### i18n URL-Segmente (`middleware.example.ts`)
**Wann aktivieren:** Wenn das Projekt mehrsprachig ist UND gute SEO + SSG wichtig ist.
**Warum:** Header-based Locale-Detection macht alle Pages dynamic (kein ISR), Google indexiert nur eine Sprache, Social-Shares landen in falscher Sprache.
**Was es bringt:** URL-Segment-Pattern `/en/...`, `/de/...`. Beide Sprachen statisch generiert, hreflang sauber, TTFB-Drop von ~1.2s auf ~100ms.

**Aktivierung:**
1. `src/middleware.example.ts` → `src/middleware.ts` umbenennen
2. Routes unter `src/app/(frontend)/[locale]/…` legen
3. Root-Layout im `[locale]/` liest `params.locale` und passt es durch
4. Jede Page liest `params.locale` und forwarded es an `RenderBlocks` + alle Komponenten
5. `SmartLink` bekommt `locale`-Prop
6. Sitemap mit hreflang alternates

**Details:** [LEARNINGS.md §3 — i18n / Lokalisierung](LEARNINGS.md)

### `seed.example.ts`
Vorlage für projekt-spezifischen Seed. `cp src/seed.example.ts src/seed.ts`, mit Content füllen.

**Konventionen** aus den Projekten:
- **EN-Base + DE-Overlay**: erst kompletten EN-Content erstellen, dann DE-Strings über `p.update({ locale: 'de' })` drüberlegen — spart Duplication
- **`mergeLocalized`-Helper** nutzen für Array-Fields (Layout, Navigation, nested Arrays)
- Seed-Helpers pro Collection in `src/seedHelpers/*.ts` — nicht alles in `seed.ts`
- **`ALLOW_SEED=true`-Flag** als Safety: `pnpm seed` droppt alle Collections, verhindert versehentliches Löschen auf Prod

**Details:** [LEARNINGS.md §2 — Localized-Array-Quirk](LEARNINGS.md)

### `mergeLocalized`-Helper (`src/lib/mergeLocalized.ts`)
Recursion-Helper für Localized-Array-Updates. Löst den Payload-Bug, dass `p.update({ locale: 'de', data: { arr: [...] } })` OHNE Item-IDs die anderen Locales löscht.

```typescript
import { mergeLayout } from '@/lib/mergeLocalized'

const existing = await p.find({ collection: 'pages', where: { slug: { equals: 'about' } }, locale: 'en' })
await p.update({
  collection: 'pages',
  id: existing.docs[0].id,
  locale: 'de',
  data: { layout: mergeLayout(existing.docs[0].layout, deLayoutOverrides) },
})
```

### `wrapper.hidden`-Toggle für Blocks
Editor kann Blocks temporär deaktivieren ohne zu löschen.

**Aktivierung:**
1. Block in `blocks/index.ts` via `withRowLabel()` registrieren
2. `pnpm generate:importmap`
3. Migration erstellen (fügt `wrapper_hidden`-Spalte auf allen Block-Tables an)

**Admin-UX:** Collapsed Block-Header zeigt `🚫 Ausgeblendet: <Type> — <Summary>` in italic + 55% Opacity.

### Archive-Page-Pattern (`isArchive: true`)
Pages-Collection hat `isArchive: boolean` Field. Markiert Docs, die als Link-Ziel für Index-Routes (`/work`, `/blog`) dienen, ohne selbst gerendert zu werden.

- SmartLink resolved Pages mit `isArchive: true` auf `/work`, `/blog` etc.
- `[slug]/page.tsx` filtert Archive-Pages in `generateStaticParams` UND rendert 404 wenn aufgerufen
- Next.js Route (`app/[locale]/work/page.tsx`) übernimmt das tatsächliche Rendering

**Details:** [LEARNINGS.md §1 — Archive-Pages-Pattern](LEARNINGS.md)

### `isHomepage`-Flag (Pages)
Pages-Collection hat `isHomepage: boolean` Field. `beforeValidate`-Hook enforcet Singleton (nur eine Page kann Homepage sein). `/`-Route fetcht Page mit `isHomepage: true`.

### CookieConsent Global
Globaler Eintrag für Banner-Copy (Titel, Body, Buttons, 4 Kategorien mit Label + Description pro Locale).

**Aktivierung:**
1. `CookieConsent` in `payload.config.ts → globals` eintragen
2. Migration laufen lassen
3. Defaults seeden (optional — Schema-Defaults greifen auch bei leerem Admin-Edit)
4. `<CookieBanner copy={...} />` im Root-Layout mounten, Copy per `payload.findGlobal({ slug: 'cookie-consent' })` fetchen

**Wichtig:** Category-Keys sind fix (`necessary`/`analytics`/`marketing`/`externalMedia`) — nur Labels + Descriptions sind lokalisierbar. Die Keys mappen auf `localStorage` + ein `cookie-consent-update` Custom-Event, das Video-Embeds lauschen.

### `prewarm-images.sh`
Post-Deploy-Script: fetcht alle Media-Docs × srcset-Varianten durch `/_next/image`. Erster User-Request landet im nginx-Cache, nicht in Sharp.

**Aktivierung:**
```json
"scripts": { "prewarm": "./scripts/prewarm-images.sh" }
```
```bash
# Nach Deploy:
pnpm prewarm
```

### `security-audit.sh`
Automatisierte Security-Audit-Checkliste. Ausführen auf Server (oder per SSH) nach Deploy:
```bash
DOMAIN=example.com BASIC_AUTH="user:pass" ./scripts/security-audit.sh
```
Output: PASS/WARN/FAIL pro Check + Log in `/tmp/audit-<date>.txt`.
**Details:** [SECURITY-AUDIT.md](SECURITY-AUDIT.md)

### Email Adapter (Maileroo / Postmark via Nodemailer)
**Wann aktivieren:** Sobald Mails rausgehen sollen — Form-Submissions, Password-Reset, Admin-Notifications. Ohne Adapter loggt Payload Mails nur in die Console (`WARN: No email adapter provided`).
**Was es bringt:** `payload.sendEmail()` funktioniert. Smart-defaults via `defaultFromAddress` / `defaultFromName`.

**Provider-Wahl + Setup-Snippets**: Komplette Empfehlung in [AGENCY-STACK.md — Transactional Mail](AGENCY-STACK.md#transactional-mail). Kurz:
- **Maileroo** — günstig + EU-Server + unlimited Domains pro Account, jüngerer Provider
- **Postmark** — premium Track-Record, Server pro Kunde, $15/mo/Server

Pro Kunde liegt der API-Key in der `.env`, kein Provider-Detail im Code.

**Templates als Code im Repo**: separat dokumentiert in [POSTMARK-TEMPLATES.md](POSTMARK-TEMPLATES.md). Empfohlenes Pattern für Multi-Template-Setups: `postmark-templates/` Verzeichnis mit Layouts + Templates als Files, Push via `scripts/sync-postmark-templates.mjs`. Inkludiert: Mustachio bilingual via inverted-section, bulletproof Button HTML, base64-Logo-Embedding, Message-Stream-Routing.

### Google Analytics 4 (`src/components/Analytics.tsx`)
**Wann aktivieren:** Wenn das Projekt Web-Analytics will UND DSGVO-konform bleiben muss.
**Warum:** Loaded GA4 erst nach expliziter `analytics`-Consent. Bis dahin wird kein Google-Request abgeschickt, kein Cookie gesetzt. Gegen das CookieBanner via `cookie-consent-update`-CustomEvent gekoppelt — kein Banner-Code muss angefasst werden.
**Was es bringt:** Standard-konforme Tracking-Implementierung. Plus: korrektes SPA-Pageview-Tracking (gtag's default page_view feuert nur initial; bei Next.js Client-Routing manuell nachschiessen).

**Aktivierung:**
1. Field `analyticsId` (text) in `SiteSettings` ergänzen — ist im Template-Default schon da.
2. In `src/app/(frontend)/layout.tsx` (oder `[locale]/layout.tsx`):
   ```tsx
   const settings = await payload.findGlobal({ slug: 'site-settings' })
   return (
     <html>
       <body>
         {children}
         <CookieBanner />
         <Analytics id={settings.analyticsId} />
       </body>
     </html>
   )
   ```
3. Im Admin → Einstellungen → Site Settings → `analyticsId` auf `G-XXXXXXXXXX` setzen.

**Zusätzliche Tracker** (Plausible, HotJar, etc.) folgen demselben Pattern: eigene Component bauen, `cookie-consent-update`-Listener registrieren, je nach Kategorie (`analytics` vs `marketing`) gaten. Banner braucht nichts.

**Caveat:** gtag.js kann nach Mount nicht clean entladen werden. Wenn der User Consent zurücknimmt, wirkt das erst beim nächsten Reload — daher exposed das Default-Banner bewusst kein Revoke-Toggle.

**Deep-Dive:** [LEARNINGS.md §12.5 — Tracking-Consent-Vertrag](LEARNINGS.md#125-tracking-consent-als-event-vertrag-nicht-als-if-chain).

### `BlockRowLabel` Custom Component
Admin-Custom-Component für Block-Header. Zeigt Block-Type, Summary und Hidden-Status.
Aktiviert via `withRowLabel()` Wrapper in `blocks/index.ts`:
```typescript
export const allBlocks = [Hero, Marquee, ...].map(withRowLabel)
```

---

## Pattern-Bibliothek (aus den Projekten)

Features, die **in den 3 live-Projekten** gebaut wurden und bei Bedarf ins Template kopiert werden können. Kein Template-Code — Rezepte.

### Event-Registration (hugenottenhaus)
**Use-Case:** Events mit Teilnehmer-Anmeldung + E-Mail-Bestätigung + Kapazitäts-Limit.

**Komponenten:**
- `Events` Collection mit `registrationRequired`, `capacity`, `startDate`
- `EventRegistrations` Collection (auth-only, read: `Boolean(req.user)`)
- `POST /api/events/register` Endpoint (validation, duplicate-check, capacity-check)
- `RegistrationForm.tsx` Client-Component (E-Mail-Validation, DSGVO-Consent)
- `lib/email.ts` Stub mit progressivem Fallback: Resend → Nodemailer → console.log
- Email-Templates: Participant-Confirmation + Admin-Notification

**Referenz:** `/Users/bugbox/dev/hugenottenhaus/payload/src/app/api/events/register/route.ts`

### Form-Submission + Honeypot (boothside)
**Use-Case:** Generisches Kontaktformular mit Bot-Schutz + Rate-Limit.

**Komponenten:**
- `FormSubmissions` Collection (admin-only read)
- `POST /api/form-submit` mit Honeypot-Field + IP-Rate-Limit
- nginx `limit_req_zone api` zusätzlich auf `/api/form-submit`

### Video-Transcoding (ludwigmoeller, boothside)
**Use-Case:** Uploaded MP4/MOV → automatisch WebM-Konvertierung für modernere Browser.

**Komponenten:**
- `Media`-Collection akzeptiert `video/mp4`, `video/quicktime`, `video/webm`
- `transcodeVideoToWebm` `afterChange`-Hook spawnt ffmpeg (`detached: true`, fire-and-forget)
- `webmUrl`-Field readonly, wird nach Completion gesetzt
- **Recovery-Pattern:** bei Update ohne `webmUrl` (z.B. ffmpeg fehlte beim ersten Upload) wird erneut transcodet
- **Voraussetzung:** ffmpeg auf dem Server (siehe [DEPLOYMENT.md §1](DEPLOYMENT.md))

**Empfohlene Encoder-Flags** (ludwigmoeller-getestet):
```bash
ffmpeg -y -i input.mov \
  # Video
  -c:v libvpx-vp9 -crf 32 -b:v 0 -deadline good -cpu-used 4 \
  # Audio — Details unten
  -c:a libopus -b:a 128k -vbr on -compression_level 10 \
  -ar 48000 -ac 2 -application audio \
  output.webm
```

**Warum diese Audio-Flags — nicht-trivial:**

- **`-ar 48000` ist non-negotiable bei Opus.** Opus hat nach Codec-Spec
  *nur* 48 kHz als native Samplerate — keine 44.1 kHz-Variante existiert.
  Wer `-ar 44100` setzt, bekommt doppeltes Resampling (Source → 44.1 via
  swr → 48 intern durch libopus). Einmal auf 48 resamplen ist sauberer.
  Will man 44.1 nativ behalten, muss der Container gewechselt werden (MP4 +
  AAC, nicht WebM).
- **`-ac 2` (Stereo-Upmix).** Browser-Decoder-Pfade sind für Stereo-Opus
  besser abgedeckt als für Mono-Streams. Handy-Aufnahmen sind oft mono;
  explizit upmixen konstant ist zuverlässiger als Opus-interne Heuristik.
- **`-vbr on -compression_level 10`.** Variable Bitrate bei höchster
  Qualität. CBR bei niedrigen Bitraten (z.B. `-b:a 96k` CBR) erzeugt
  hörbares Pumping bei Signal-Peaks. Mit VBR ist die `-b:a`-Zahl ein
  Zielwert, nicht Maximum — Opus nimmt bei Stille wenig, bei Peaks mehr.
- **`-application audio`.** Opus auto-detected sonst zwischen `voip`,
  `audio`, `lowdelay` — bei kurzen Handy-Recordings oft falsch geraten.

**Siehe:**
- [KNOWN-ISSUES.md — Video-Upload blockt Re-Uploads](KNOWN-ISSUES.md)
- [KNOWN-ISSUES.md — Video-Audio klingt verzerrt / pumpt](KNOWN-ISSUES.md)

### Package-Configurator (boothside)
**Use-Case:** Interactive Preis-Konfigurator (Tier-Auswahl + Medium-Mix).

**Komponenten:**
- `PackageTiers` Collection (5 Tiers: Starter/Story/Day/Pool/Bundle)
- `m15-packages-configurator` Block mit Client-Component
- Slug-basierte Identifikation (nicht ID) — siehe [KNOWN-ISSUES.md — Payload-ID vs Slug](KNOWN-ISSUES.md)

### Bento-Grid / ArtWorks (ludwigmoeller, boothside)
**Use-Case:** Dynamischer Kachel-Grid (Künstler-Tiles / Work-Showcase).

**Komponenten:**
- `ArtWorks` / `Work`-Collection mit `type`, `size`, `order`
- Fixed-Layout-Pattern: Layout ist im Component hardcoded, nur Content im CMS
- `grid-flow-dense` für Hole-Filling

**Details:** [LEARNINGS.md §8 — Content-vs-Layout-Trennung](LEARNINGS.md)

### Trade-Shows / Events mit Detail-Pages (boothside, hugenottenhaus)
**Use-Case:** Events-Liste mit optionalen Detail-Seiten (manche Events brauchen Deep-Link, andere nicht).

**Komponenten:**
- `Events` Collection mit `layout`-Field (Blocks)
- `hasDetailPage` `beforeChange`-Hook setzt Flag auf `true` wenn Layout nicht leer
- Filter in Event-List-Block: `hasDetailPage ? Link : Static`

### Blog-Posts mit Reading-Time (boothside)
**Use-Case:** Artikel mit geschätzter Lesezeit.

**Komponenten:**
- `Posts`-Collection mit Lexical-RichText-Feld
- `setReadingTime` `beforeChange`-Hook zählt Wörter (~200 wpm)
- `featured: boolean` mit Singleton-Hook

### Artist-Marquee (hugenottenhaus)
**Use-Case:** Scrolling-Laufband mit Hover-Portraits.

**Komponenten:**
- `Artists`-Collection mit `portrait`-Upload
- `m11-artist-marquee` — Server-Component (Data) + Client-Component (Animation + Cursor-Portrait)
- Wrapper: `ArtistMarqueeWrapper.tsx` (Server), rendert dann Client

### Testimonials / Awards / Qualifications (ludwigmoeller)
**Use-Case:** Taxonomie-ähnliche Collections mit Server-Block-Rendering.

**Komponenten:**
- `Testimonials`, `Awards`, `Qualifications` als separate Collections
- Blocks (`m6-testimonials`, `m10-qualifications`, `m11-awards-list`) sind Server-Components, queryen direkt die DB

### Live Preview (alle Projekte)
**Aktiv-Beispiel:**
```typescript
// payload.config.ts
livePreview: {
  url: ({ data, collectionConfig }) => {
    if (collectionConfig.slug === 'pages') return data.slug === 'home' ? '/' : `/${data.slug}`
    if (collectionConfig.slug === 'events') return `/programm/${data.slug}`
    // ...
  },
  breakpoints: [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 },
  ],
}
```
Muss manuell erweitert werden, wenn neue Collections hinzukommen.

---

## Feature-Matrix: welches Projekt hat was?

| Feature | ludwigmoeller | hugenottenhaus | boothside |
|---|---|---|---|
| Wrapper/Container, SmartLink, slugField | ✅ | ✅ | ✅ |
| i18n URL-Segmente | ❌ (Content localized, URLs nicht) | ❌ | ✅ |
| Localized Content (DE + EN) | ✅ | ✅ | ✅ |
| Cookie Banner | ✅ | ✅ | ✅ |
| Video-Transcoding | ✅ | ❌ | — (nur Bilder) |
| Event-Registration | ❌ | ✅ | ❌ |
| Form-Submission + Honeypot | ❌ | ❌ | ✅ |
| Package-Configurator | ❌ | ❌ | ✅ |
| Trade-Shows / Events mit Detail | ❌ | ✅ | ✅ |
| Blog-Posts + Reading-Time | ❌ | ❌ | ✅ |
| Testimonials / Awards / Qualifications | ✅ | ❌ | ❌ |
| Artist-Marquee | ❌ | ✅ | ❌ |
| Bento-Grid | ✅ (ArtWorks) | ❌ | ✅ (Work) |
| Block-Count | 16 (m1–m16) | 22 | 22 (m1–m22) |
| Collections | 8 | 8 | 11 |
| Globals | 3 | 3 | 4 (+ CookieConsent) |
| Deployment | Docker + Caddy | (lokal) | PM2 + systemd + nginx |

Siehe [PROJECTS.md](PROJECTS.md) für Projekt-Details und Stack-Abweichungen.

---

## Geplante Features (Specs ohne Implementation)

### Form-Builder — Powermail-Äquivalent für Payload
**Status:** Spec ist geschrieben, nicht gebaut.
**Zweck:** Editor-konfigurierbare Forms mit beliebigen Feldtypen, Validation, Conditional Logic, Multi-Step und Mail-Routing — analog zum TYPO3-Powermail-Plugin. Löst die manuell-pro-Use-Case-gebauten Form-Blocks (`m18-contact-form` etc.) ab, sobald 3+ distinkte Form-Varianten in einem Projekt anfallen.
**Spec:** [FORM-BUILDER-SPEC.md](FORM-BUILDER-SPEC.md) — komplette Schema-Definition, Submit-Endpoint-Pseudo-Code, Renderer-Skizze und 3-Phasen-Bau-Plan.

---

## Neue Features ins Template einbauen

Wenn ein Pattern sich in ≥2 Projekten bewährt hat, kandidiert es für den Template.

**Checkliste:**
1. Pattern generalisieren: alle projekt-spezifischen Strings entfernen
2. In `src/` an passender Stelle platzieren (`fields/`, `lib/`, `components/`, `hooks/`)
3. Wenn Schema-Änderung: Migration-Skript bereitstellen oder dokumentieren
4. Wenn Custom-Admin-Component: `pnpm generate:importmap` Hinweis
5. Section in diesem File hinzufügen
6. Eintrag in [PROJECTS.md → Feature-Matrix](PROJECTS.md) ergänzen
7. Wenn nicht-trivial: Details in [LEARNINGS.md](LEARNINGS.md)
8. Wenn es einen häufigen Bug gibt: [KNOWN-ISSUES.md](KNOWN-ISSUES.md)
