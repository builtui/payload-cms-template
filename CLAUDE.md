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
- `PayloadImage` component wraps Next.js `<Image>` for lazy-loading
- Media collection has a `folder` select field for organization

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
