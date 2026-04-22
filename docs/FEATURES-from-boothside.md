# Features added from the Boothside project

This branch brings 7 production-tested features/patterns from the Boothside
project into the template. Each is a **self-contained commit**, so you can
cherry-pick what you need per project — or merge the whole branch for the
full kit.

Commits on this branch, in order:

1. `docs:` — LEARNINGS + security audit + scripts/prewarm-images.sh + scripts/security-audit.sh
2. `feat(blocks):` — `wrapper.hidden` toggle + custom BlockRowLabel
3. `feat(lib):` — `mergeLocalized` helpers for safe locale-overlay seeds
4. `feat(i18n):` — URL-segment pattern, opt-in (middleware.example.ts + lib/locale.ts)
5. `feat(cookies):` — CookieConsent global + editable banner copy
6. `feat(pages):` — `isHomepage` + `isArchive` sidebar flags
7. `perf(next):` — image-optimizer cache settings + inline CSS

Below: how to activate each one in a project that derives from this template.

---

## 1. Documentation + Scripts

**No activation needed — just read / run.**

- **`docs/LEARNINGS-boothside.md`** — the source document. When you merge
  learnings from multiple projects, keep the per-project files separate
  first (`LEARNINGS-<project>.md`), then consolidate into a shared
  `LEARNINGS.md` with conflict resolution.
- **`docs/SECURITY-AUDIT-checklist.md`** — ready-to-use manual checklist
  for quarterly audits. Project-agnostic.
- **`scripts/security-audit.sh`** — automated version of the checklist.
  Run on the server (or via SSH) after deploy:
  ```bash
  DOMAIN=example.com BASIC_AUTH="user:pass" ./scripts/security-audit.sh
  ```
  Outputs PASS/WARN/FAIL per check, plus a full log at `/tmp/audit-<date>.txt`.
- **`scripts/prewarm-images.sh`** — fetches every media doc × srcset
  variant through `/_next/image` so the first real visitor hits a warm
  cache. Add `pnpm prewarm` to your deploy flow:
  ```json
  "scripts": { "prewarm": "./scripts/prewarm-images.sh" }
  ```

---

## 2. Block "hidden" toggle

**Already active** once a block uses `makeWrapperFields()` and you register
it via `withRowLabel()`.

**Activate for a block**:

```typescript
// src/blocks/index.ts
import { Hero } from './Hero'
import { PageTitle } from './PageTitle'

const baseAllBlocks: Block[] = [Hero, PageTitle]
export const allBlocks = baseAllBlocks.map(withRowLabel)  // ← important
```

**One-time after adding the helper**:

```bash
pnpm generate:importmap
```

**Result**:
- Editor sees a "Section ausblenden"-checkbox as the first field inside
  every block's wrapper group.
- Collapsed block header reads `🚫 Ausgeblendet: <BlockType> — <Summary>`
  in italic + 55% opacity when toggled on.
- `RenderBlocks` filters hidden blocks out — the block stays in the DB,
  but the frontend skips it.

---

## 3. mergeLocalized helpers

**Already available** at `src/lib/mergeLocalized.ts`. Use when seeding
translations over an existing document so you don't nuke the source-locale
data.

```typescript
import { mergeLayout } from '@/lib/mergeLocalized'

async function updateAboutPageDe(p: Payload) {
  const existing = await p.find({
    collection: 'pages',
    where: { slug: { equals: 'about' } },
    locale: 'en',
    depth: 0,
  })
  const enDoc = existing.docs[0]
  if (!enDoc) return

  const deLayoutOverrides = [
    { blockType: 'm1-hero', line1: 'Ihr Messestand', line2: 'wird zu Content' },
    // ...
  ]

  await p.update({
    collection: 'pages',
    id: enDoc.id,
    locale: 'de',
    data: {
      title: 'Über uns',
      layout: mergeLayout(enDoc.layout, deLayoutOverrides),
    },
  })
}
```

See `docs/LEARNINGS-boothside.md` §2 "Payload-CMS-Gotchas — Das
Localized-Array-Quirk" for the underlying problem this solves.

---

## 4. i18n URL segments (OPT-IN)

**Activation steps**:

1. **Rename** `src/middleware.example.ts` → `src/middleware.ts`.
2. **Restructure routes**: move everything under
   `src/app/(frontend)/[locale]/…`. The old `[slug]` becomes
   `[locale]/[slug]`, `about/` becomes `[locale]/about/`, etc.
3. **Root layout inside `[locale]/`** reads `params.locale`:
   ```tsx
   type Props = { children: React.ReactNode; params: Promise<{ locale: string }> }

   export function generateStaticParams() {
     return ['en', 'de'].map((locale) => ({ locale }))
   }

   export default async function LocaleLayout({ children, params }: Props) {
     const { locale } = await params
     return (
       <html lang={locale}>
         <body>
           <Header locale={locale} />
           {children}
           <Footer locale={locale} />
         </body>
       </html>
     )
   }
   ```
4. **Every page** reads `params.locale` and passes it as prop to
   child components and `RenderBlocks`. This is crucial for SSG —
   don't call `currentLocale()` from leaf components (makes them
   dynamic).
5. **SmartLink** gets a `locale` prop wherever you instantiate it.
6. **Sitemap** emits hreflang alternates (see Boothside's
   `src/app/sitemap.ts` as reference).

For the full pattern + rationale (TTFB drop from ~1.2s to ~100ms via
SSG), see `docs/LEARNINGS-boothside.md` §3 "i18n / Lokalisierung".

**Skip this feature** if your site is single-language — the
`middleware.example.ts` stays dormant as a file and has no effect.

---

## 5. CookieConsent global

**Activation steps**:

1. **Register the global** in `src/payload.config.ts`:
   ```typescript
   import { CookieConsent } from './globals/CookieConsent'

   export default buildConfig({
     // ...
     globals: [SiteSettings, Navigation, Footer, CookieConsent],
   })
   ```
2. **Run migration** (if you're using `migrations` mode in prod):
   ```bash
   pnpm payload migrate:create add_cookie_consent_global
   pnpm payload migrate
   ```
3. **Seed default copy** (optional — defaults in the schema take effect
   at first admin-edit regardless):
   ```typescript
   await p.updateGlobal({
     slug: 'cookie-consent',
     locale: 'en',
     data: {
       title: 'This website uses cookies',
       body: 'We use cookies to…',
       privacyLinkLabel: 'privacy policy',
       ctaAcceptAll: 'Accept all',
       // ... etc
       categories: [
         { key: 'necessary', label: 'Necessary', description: '…' },
         { key: 'analytics', label: 'Statistics', description: '…' },
         { key: 'marketing', label: 'Marketing', description: '…' },
         { key: 'externalMedia', label: 'External media', description: '…' },
       ],
     },
   })
   ```
4. **Mount the banner** in your root layout, passing the fetched copy:
   ```tsx
   import { CookieBanner, type CookieConsentCopy } from '@/components/CookieBanner'
   import { buildLocalePath } from '@/lib/locale'

   async function fetchCookieCopy(locale: string): Promise<CookieConsentCopy> {
     const doc = await payload.findGlobal({ slug: 'cookie-consent', locale })
     return { ...doc, privacyHref: buildLocalePath(locale, '/privacy') }
   }

   // In LocaleLayout:
   const cookieCopy = await fetchCookieCopy(locale)
   // <CookieBanner copy={cookieCopy} />
   ```

**Category keys are fixed** (`necessary` / `analytics` / `marketing` /
`externalMedia`) because they map to `localStorage` keys + the
`cookie-consent-update` custom event that video-embed gates listen to.
Only the labels + descriptions are localizable.

---

## 6. isHomepage / isArchive flags

**Already active** once you import the updated `Pages.ts`. Two
sidebar-position checkboxes:

- `isHomepage` — backed by a `beforeValidate` hook that enforces
  singleton-constraint (exactly one page can be the homepage).
- `isArchive` — placeholder flag for pages that correspond to a
  Next.js index route (`/work`, `/blog`, etc.). Your `[slug]/page.tsx`
  must filter these out:

```tsx
export async function generateStaticParams() {
  const pages = await payload.find({ collection: 'pages' })
  return pages.docs
    .filter((p) => !p.isHomepage && !p.isArchive)
    .map((p) => ({ slug: p.slug }))
}

export default async function DynamicPage({ params }) {
  const { slug } = await params
  const page = await fetchBySlug(slug)
  if (!page || page.isArchive) return notFound()
  return <RenderBlocks blocks={page.layout} />
}
```

---

## 7. Image-optimizer perf

**Already active** in `next.config.ts`. The defaults now include:
- 30-day Sharp-output disk cache (was 4h)
- 3 device widths + 3 image sizes (was 8+7 = 15)
- AVIF → WebP format negotiation
- Inline critical CSS

**Recommended companion: nginx proxy_cache** in front of `/_next/image`.
The full nginx snippet is in `docs/LEARNINGS-boothside.md` §4
"Next.js Image Optimizer braucht einen persistent Cache". Core config:

```nginx
# http{} context:
proxy_cache_path /var/cache/nginx/images
                 levels=1:2 keys_zone=nextimg:100m max_size=2g
                 inactive=30d use_temp_path=off;

# server{} context:
location /_next/image {
    proxy_cache nextimg;
    proxy_cache_valid 200 30d;
    proxy_cache_lock on;
    proxy_pass http://127.0.0.1:3000;
    expires 30d;
    add_header X-Cache-Status $upstream_cache_status;
}
```

Combined with `pnpm prewarm` after deploy → first visitors never pay
the Sharp-processing cost.

---

## Deployment checklist

Adapt for your project — most of this applies uniformly:

- [ ] `pnpm generate:importmap` after adding `withRowLabel()` or other custom admin components
- [ ] `pnpm payload migrate:create <name>` + `pnpm payload migrate` after any schema change
- [ ] `rm -rf .next/server .next/static .next/types .next/build-manifest.json .next/app-build-manifest.json` instead of `rm -rf .next` (preserves image cache!)
- [ ] `pnpm build` + `pm2 restart` + `pnpm prewarm`
- [ ] `./scripts/security-audit.sh` quarterly or before go-live

See `docs/LEARNINGS-boothside.md` §6 "DevOps / Deployment" for the full
deploy-flow documentation.
