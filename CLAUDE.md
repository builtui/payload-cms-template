# Payload CMS Module Template

## Overview
This is a modular Payload CMS + Next.js template with a Wrapper/Container architecture for building content-driven websites. Every content block is wrapped in a `<section>` (full-width) → `.edge` (content-width) → Content pattern. Spacing between modules is controlled exclusively through padding inside the wrapper, never through margins between modules.

## Tech Stack
- **CMS**: Payload CMS v3 + Lexical Rich Text
- **Frontend**: Next.js (App Router) + React 19
- **Styling**: Tailwind CSS v4 (Preflight active)
- **Database**: PostgreSQL via `@payloadcms/db-postgres`
- **Images**: Sharp (auto WebP conversion, quality 82, responsive sizes)
- **SEO**: `@payloadcms/plugin-seo`
- **i18n**: DE (default) + EN, with fallback

## Architecture

### Wrapper/Container System (Core Principle)
Every block component uses `BlockWrapper`:
```
<section>           ← full-width (background colors go here)
  <div class="edge"> ← content-width (16/32/48px responsive padding)
    [dividerTop]     ← optional border-t border-deep-black
    [content]
    [dividerBottom]  ← optional border-b
  </div>
</section>
```
- Modules sit 0px apart. Spacing comes ONLY from padding inside the wrapper.
- `paddingTop` and `paddingBottom` are separately controllable per block.
- `dividerTop` and `dividerBottom` are optional checkboxes.
- Background can be `transparent`, `warm-white`, or `deep-black`.

### Block Numbering
Blocks should use concept-number slugs: `m1-page-title`, `m2-hero`, `m3-text-image-split`, etc.
Labels in admin: `M3 Text-Bild Split`. Blocks are NOT included in the template — build them per project. This creates a shared language between design concept, CMS admin, and code.

### Smart Link System
`linkField()` creates a radio toggle (Internal/External):
- **Internal**: Relationship dropdown (select a page/event/artist/project) — no manual slug typing
- **External**: URL field + "open in new tab" checkbox
- `SmartLink` component auto-selects icon: ArrowRight → for internal, ArrowUpRight ↗ for external
- `COLLECTION_PATHS` map in SmartLink.tsx defines URL prefixes per collection

### Image Handling
- Payload auto-generates: `thumbnail` (400x300), `card` (768x576), `hero` (1920x)
- `formatOptions: { format: 'webp', quality: 82 }` converts all uploads to WebP
- `PayloadImage` component uses Next.js `<Image fill>` for lazy-loading, srcset, and format negotiation
- Always use `PayloadImage` inside a container with `className="relative"` + an aspect ratio
- Set `sizes` prop to match the block's column width (e.g. `"(min-width: 768px) 58vw, 100vw"` for 7/12 columns)
- Media collection has a `folder` select field for organization

### Performance (ISR/SSG)
- All pages export `revalidate = 60` — static cache, regenerated every 60 seconds
- Dynamic `[slug]` routes use `generateStaticParams` to pre-render at build time
- New pages created after build are generated on-demand on first visit, then cached
- `next.config.ts` has `images.remotePatterns` configured for Payload media URLs

**IMPORTANT — `generateStaticParams` must be wrapped in try/catch:**
```tsx
export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const pages = await payload.find({ collection: 'pages', limit: 100 })
    return pages.docs.map((p: any) => ({ slug: p.slug }))
  } catch {
    // DB not reachable at build time — fall back to on-demand generation
    return []
  }
}
```
Without this, `pnpm build` fails if the DB is unreachable (common in CI environments where the build container has no DB access). With the fallback, Next.js generates pages on-demand on first visit — slightly slower for the first visitor but the build never fails.

### Slug Handling
The `slugField()` helper in `src/fields/slugField.ts` auto-generates URL-safe slugs from a source field via `slugify()`:
```ts
fields: [
  { name: 'title', type: 'text', required: true },
  slugField('title'),  // auto-generates from 'title', editor can override
]
```
- German umlauts transliterated: `ö → oe`, `ä → ae`, `ü → ue`, `ß → ss`
- Accented characters stripped: `á → a`, `ñ → n`, `ç → c`
- Lowercased, special chars → hyphens, multiple hyphens collapsed
- Works as `beforeValidate` hook → fires before unique-check, so sanitized slug is validated

### Taxonomy Pattern (editor-managed tags)
For categories/tags that editors should be able to manage (add, rename, delete), use a **separate collection** with a relationship field, NOT a static `select`:

```ts
// 1. Create a taxonomy collection (e.g. EventTypes)
export const EventTypes: CollectionConfig = {
  slug: 'event-types',
  admin: { useAsTitle: 'name', group: 'Einstellungen' },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
  ],
}

// 2. Reference it from the main collection with hasMany for multi-select
{ name: 'types', type: 'relationship', relationTo: 'event-types', hasMany: true }
```

**Why not a static `select`?** Because adding/renaming options would require code changes. With a relationship, editors manage categories in the admin.

### SEO Files (robots.txt + sitemap.xml)
- `src/app/robots.ts` and `src/app/sitemap.ts` use Next.js' Metadata Route conventions
- They must live in `src/app/` directly — **NOT** inside `(frontend)/` route group, because Next.js ignores route groups for metadata files
- `robots.ts` blocks `/admin` and `/api` from crawlers
- `sitemap.ts` queries the DB and generates entries for every Page — extend for additional collections (see inline comments)
- Both use `NEXT_PUBLIC_SITE_URL` env var — set this to your production domain

## File Structure
```
src/
├── blocks/          # Block SCHEMA definitions (Payload fields)
├── fields/          # Reusable field definitions (wrapperFields, linkField)
├── collections/     # Collection configs (Pages, Events, Artists, Projects, Media, Users)
├── globals/         # Global configs (SiteSettings, Navigation, Footer)
├── components/
│   ├── blocks/      # Block RENDER components (React/TSX)
│   ├── icons/       # SVG icon components (ArrowRight, ArrowUpRight)
│   ├── BlockWrapper.tsx   # Core wrapper component
│   ├── RenderBlocks.tsx   # blockType → Component mapping
│   ├── SmartLink.tsx      # Auto-icon link component
│   ├── CookieBanner.tsx   # GDPR cookie consent
│   ├── RichText.tsx       # Lexical → HTML renderer
│   └── PayloadImage.tsx   # Next.js Image wrapper
├── app/
│   ├── (frontend)/  # Public routes + globals.css
│   └── (payload)/   # Admin panel (auto-generated)
└── payload.config.ts
```

## Key Rules

### Tailwind CSS v4 + Preflight
- Preflight sets `margin: 0` on ALL elements. NEVER rely on browser defaults.
- NEVER use `margin: revert` on `*` — it destroys layouts.
- Tailwind utility classes (`mb-8`, `pt-4`) override Preflight because `@layer utilities` beats `@layer base`.
- If a Tailwind class doesn't work, check if it exists in the compiled CSS (content detection).

### Section Labels
Always use `mb-6 md:mb-8` for section labels (consistent with prototype). No special solutions.

### Payload Version Matching
ALL `@payloadcms/*` packages MUST have the SAME version. Payload checks this at startup.

### Mobile Menu
Rendered via `createPortal(element, document.body)` to escape the header's stacking context (`z-50`).

### Server vs Client Components
- Server Components (async): EventList, ProjectCards, ArtistMarquee (wrapper), ArtistFeature, ArtistPair, KeyInfoBlock
- Client Components ('use client'): MobileMenu, ArtistMarquee (animation), CookieBanner, VideoEmbed, NavLinks, HeaderScroll

### GDPR (DSGVO)
- Cookie Banner: 4 categories (Necessary, Analytics, Marketing, External Media)
- YouTube: `youtube-nocookie.com`, Vimeo: `dnt=1`
- Video Consent Gate: 3 states (no consent → placeholder, consent → poster+play, active → iframe)
- Fonts + icons self-hosted (no CDN)
- "Load video once" = single consent (GDPR Art. 6 Abs. 1a)

## Commands
```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm seed             # Seed database
pnpm generate:importmap  # After block changes
pnpm generate:types      # TypeScript types

# Full reseed:
rm -rf media/ && psql -d DB_NAME -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" && pnpm seed
```

## Customization (New Project)
1. **Design Tokens**: Edit `globals.css` — colors, font, `.edge` spacing
2. **Assets**: Replace `public/fonts/` and `public/images/`
3. **Collections**: Adapt fields in `src/collections/`
4. **Blocks**: Add/remove in `src/blocks/`, update `index.ts` arrays and `RenderBlocks.tsx`
5. **Routes**: Update `src/app/(frontend)/` and `COLLECTION_PATHS` in SmartLink.tsx
6. **Seed**: Copy `seed.example.ts` → `seed.ts`, fill with project content
7. **Config**: Update `livePreview.url` mapping in `payload.config.ts`
8. **Env**: Set `NEXT_PUBLIC_SITE_URL` in `.env` (used by robots.ts + sitemap.ts)
9. **Sitemap**: Extend `src/app/sitemap.ts` when you add content collections
10. **Images**: Add your production domain to `images.remotePatterns` in `next.config.ts`

## Production Deployment

### Seed vs Migrations
- `pnpm seed` is for **local development only** — it drops the schema and re-populates with demo data
- In production, use **migrations** via `pnpm payload migrate` to create/update tables safely
- The first user is created via the admin UI on first visit (`/admin` → "Create First User"), never via seed
- Never run `pnpm seed` against a production database — it will destroy all data

### Pre-deployment Checklist
- [ ] Generate strong `PAYLOAD_SECRET`: `openssl rand -hex 32`
- [ ] Set `DATABASE_URL` to production Postgres (with password)
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the canonical production URL
- [ ] Add production domain to `images.remotePatterns` in `next.config.ts`
- [ ] Configure email adapter (for password reset) — e.g. `@payloadcms/email-nodemailer`
- [ ] Consider S3-compatible media storage (`@payloadcms/storage-s3`) — local `staticDir` loses files on each redeploy
- [ ] Run `pnpm build` locally to verify it compiles cleanly
- [ ] Set up automatic DB backups (Supabase/Neon/Railway usually provide this)
