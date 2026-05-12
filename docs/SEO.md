# SEO — Title, Description, Canonical, hreflang

How per-page SEO metadata flows from Payload to the rendered HTML. Read this before adding a new route or before debugging "Google isn't indexing my pages."

> **Story:** Boothside shipped with the editor filling plugin-seo title/description for every page in both locales — and none of it reached the frontend. The detail routes (`work/[slug]`, `trade-shows/[slug]`, `blog/[slug]`) each had their own `generateMetadata` returning only `{ title }`, ignoring `meta` entirely. Search Console filled with "Crawled — currently not indexed." This template now ships with the wiring so the bug can't repeat.

---

## What the template ships

| Piece | File | Job |
|---|---|---|
| Plugin-SEO admin tab | `src/payload.config.ts` | adds `meta.title` / `meta.description` / `meta.image` to every configured collection |
| Default OG image | `src/globals/SiteSettings.ts` (`defaultOgImage`) | site-wide fallback when a doc has no own cover |
| `buildPageMetadata` helper | `src/lib/seo.ts` | reads the doc + SiteSettings, emits a complete Next.js Metadata object |
| Root layout defaults | `src/app/(frontend)/layout.tsx` | `metadataBase`, brand title template, fallback OG block |
| Sitemap | `src/app/sitemap.ts` | auto-generated from `pages` collection |
| Robots | `src/app/robots.ts` | allows everything except `/admin` + `/api`, references sitemap |

`buildPageMetadata` is the single seam every route goes through. If a route doesn't call it, the editor's SEO inputs never reach the HTML head — that's exactly the Boothside bug.

---

## The wiring pattern (every route)

Every page route — homepage, `[slug]`, custom collections — needs **both** the default export AND `generateMetadata`. Skip the second and the editor's work is invisible.

```tsx
// src/app/(frontend)/about/page.tsx (or any other route)
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RenderBlocks } from '@/components/RenderBlocks'
import { buildPageMetadata } from '@/lib/seo'

export const revalidate = 60

async function fetchAbout() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: 'about' } },
    limit: 1,
  })
  return result.docs[0]
}

export default async function AboutPage() {
  const page = await fetchAbout()
  return <RenderBlocks blocks={(page?.layout as any[]) || []} />
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchAbout().catch(() => null)
  return buildPageMetadata(page as any, { pathSuffix: 'about' })
}
```

The `pathSuffix` is the URL after the site root, without leading slash. For the homepage pass `''`. For nested routes like `/work/atmosphere` pass `'work/atmosphere'`. This drives the canonical URL.

`buildPageMetadata` does all the rest:

- Reads `doc.meta.title` (editor) → falls back to `${doc.title} — ${siteName}`. Emits as `title: { absolute }` so the layout's `template` does NOT double-append the brand.
- Reads `doc.meta.description` → falls back through `excerpt` / `shortIntro` / `description`.
- Image: `doc.meta.image` → `doc.cover` → `doc.coverImage` → `SiteSettings.defaultOgImage`.
- Always emits a canonical `<link>`.
- Emits OpenGraph + Twitter Card.

---

## Editor workflow

The editor fills the **SEO tab** that `@payloadcms/plugin-seo` adds to every collection in `seoPlugin.collections` (configured in `payload.config.ts`):

- **Meta Title** — full title, including brand. Plugin-seo's preview shows how it looks in Google's SERP. Aim for ≤ 60 chars.
- **Meta Description** — 130–160 chars. Plugin-seo flags too short / too long.
- **Meta Image** — 1200×630 px recommended, gets used in OG cards and search-engine snippets.

If the editor leaves a field empty, the fallback chain in `buildPageMetadata` kicks in. That's fine for low-value pages but every key page (home, packages, contact, every collection detail) should have all three filled manually — the fallbacks produce duplicate snippets across pages, which Google reads as "thin content" and quietly drops from the index.

---

## Multi-locale (i18n) activation

Single-locale is the default. When you switch to i18n (rename `middleware.example.ts` → `middleware.ts`, move routes under `[locale]/`):

1. **Pass locale into every `buildPageMetadata` call:**

   ```tsx
   return buildPageMetadata(page, {
     locale: locale as 'de' | 'en',
     pathSuffix: `work/${slug}`,
   })
   ```

   With `locale` set, the helper emits `alternates.canonical` for the current locale AND `alternates.languages` with one entry per locale + `x-default` (pointing at `MULTI_LOCALE_DEFAULT` in `lib/seo.ts`). That's where the `hreflang` link tags come from.

2. **Update `MULTI_LOCALE_LOCALES` and `MULTI_LOCALE_DEFAULT` in `lib/seo.ts`** to match the locale list in `payload.config.ts` → `localization.locales` and `defaultLocale`.

3. **Update `sitemap.ts`** to emit one entry per locale per URL with `alternates.languages` — see the i18n example block at the top of that file. Google reads both HTML hreflang and sitemap hreflang; emit both.

4. **Root middleware uses 308**, not 307 — that's the canonical-signaling redirect for permanent locale routing. The example file already has this. Don't downgrade to 307.

---

## Common gotchas

### "My title is doubled — 'Page — Brand — Brand'"

Cause: the editor's SEO title already includes the brand, AND the root layout's `title.template: '%s — Brand'` is appending it again.

Fix: this template's `buildPageMetadata` uses `title: { absolute }`. If you wrote a `generateMetadata` somewhere that returns a plain `{ title: '...' }`, the layout template kicks in. Always go through `buildPageMetadata` or explicitly use `{ title: { absolute: '...' } }`.

### "Description on every detail page is identical / wrong language"

Cause: a detail route's `generateMetadata` doesn't read `doc.meta.description`. The root layout's `description` is the fallback, and it's site-wide and (in a single-locale site) typically a single language. Google flags this as duplicate / thin / wrong-language content.

Fix: route the call through `buildPageMetadata`. Check with:

```bash
curl -sL https://your-site.com/your/detail/page \
  | grep -E '<title>|<meta name="description"|<link rel="canonical"'
```

### "OG image is missing on social shares"

Cause: doc has no `meta.image` and no `cover`/`coverImage`, AND `SiteSettings.defaultOgImage` is empty.

Fix: upload an OG image to SiteSettings → `defaultOgImage` (1200×630 px). It becomes the catch-all fallback. For pages where it matters (homepage, packages, top blog posts), upload a page-specific `meta.image` in the SEO tab.

### "Search Console shows 'Duplicate, Google chose different canonical'"

Cause: in i18n mode, you didn't pass `{ locale }` into `buildPageMetadata`, so canonical points to `/about` instead of `/de/about` — and Google sees `/de/about` AND `/en/about` competing.

Fix: add `locale: '...'` to every `buildPageMetadata` call in i18n mode.

### "Build complains about `metadataBase` missing"

Cause: a metadata value uses a relative URL (e.g. Payload media URL `/api/media/file/foo.webp` for `og:image`) and `metadataBase` isn't set in the root layout.

Fix: the template's `(frontend)/layout.tsx` already sets `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || ...)`. Just make sure `NEXT_PUBLIC_SITE_URL` is set in `.env` to the production domain BEFORE running `pnpm build` — Next.js bakes it in at build time for client bundles.

---

## Verification checklist (post-deploy)

```bash
SITE=https://your-site.com

# 1. Canonical + hreflang on a representative page
curl -sL "$SITE/your/detail/page" | grep -E \
  '<title>|<meta name="description"|<link rel="canonical"|hreflang'

# 2. Sitemap reachable + populated
curl -s "$SITE/sitemap.xml" | grep -c '<loc>'

# 3. Robots.txt allows crawling, references sitemap
curl -s "$SITE/robots.txt"

# 4. (i18n only) Root redirect is 308 with correct Location
curl -sI "$SITE/" -H "Accept-Language: de-DE" | grep -iE "HTTP|location"
```

Then in Google Search Console:

1. Sitemaps → submit `sitemap.xml` (re-submitting triggers a recrawl)
2. URL Inspection on 2-3 detail pages → "Request Indexing"
3. Page indexing report — one week later, "Crawled — currently not indexed" should empty out

---

## Related docs

- [LEARNINGS.md §9](LEARNINGS.md#9-bugs-die-sich-wiederholen-können) — the Boothside indexing incident as a lesson learned
- [KNOWN-ISSUES.md](KNOWN-ISSUES.md) — "SEO" section for symptom → fix lookup
- [NEW-PROJECT.md — Phase 2 D](NEW-PROJECT.md#d-routes-anlegen) — checklist when adding routes
