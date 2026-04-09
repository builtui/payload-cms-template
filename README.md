# Payload CMS Module Template

A production-ready Payload CMS + Next.js template with a modular block architecture, GDPR compliance, and smart content editing features.

## Features

- **Wrapper/Container System** — Consistent spacing architecture where modules sit 0px apart and spacing is controlled through inner padding
- **Smart Links** — Internal links via relationship picker (no manual slug typing), external links with auto-icon selection
- **GDPR Cookie Banner** — 4 categories (Necessary, Analytics, Marketing, External Media) with video consent gate
- **Image Optimization** — Auto WebP conversion, responsive sizes (thumbnail, card, hero), Next.js `<Image>` support
- **SEO Plugin** — Meta title, description, image on all content collections
- **Live Preview** — Preview content changes in real-time with responsive breakpoints
- **i18n** — German (default) + English with fallback
- **Accessibility** — Focus-visible states, skip-to-content link, ARIA attributes, keyboard navigation
- **ISR/SSG** — Static generation with 60s revalidation for near-instant page loads
- **Self-hosted everything** — Fonts, icons, no CDN dependencies (GDPR compliant)

## Quick Start

```bash
# Clone
git clone https://github.com/builtui/payload-cms-template.git my-project
cd my-project

# Install
pnpm install

# Configure
cp .env.example .env
# Edit .env with your database URL

# Create database
psql -c "CREATE DATABASE my_project;"

# Generate import map
pnpm generate:importmap

# Start
pnpm dev
```

## Customization

### 1. Design Tokens
Edit `src/app/(frontend)/globals.css`:
```css
@theme {
  --color-warm-white: #F5F2ED;  /* Background */
  --color-deep-black: #1A1A1A;  /* Text */
  --color-anthracite: #4A4A4A;  /* Secondary text */
  --color-warm-gray: #B5B0A8;   /* Tertiary text */
  --color-line: #D9D5CF;        /* Subtle dividers */
  --font-sans: "Your Font", system-ui, sans-serif;
}
```

### 2. Assets
- `public/fonts/` — Your project font (woff2)
- `public/images/` — Logos, favicon

### 3. Content Structure
- **Collections**: `src/collections/` — Add your content types (e.g. Events, Artists, Projects)
- **Blocks**: `src/blocks/` — Build your modules, register in `index.ts` and `RenderBlocks.tsx`
- **Routes**: `src/app/(frontend)/` — Add page routes for your collections

### 4. Seed Data
```bash
cp src/seed.example.ts src/seed.ts
# Edit with your content
pnpm seed
```

## Building Blocks

Blocks are **not included** — build them per project based on your design concept. The template provides the infrastructure:

| What | File | Purpose |
|------|------|---------|
| Block schema | `src/blocks/MyBlock.ts` | Payload field definitions |
| Block component | `src/components/blocks/MyBlockBlock.tsx` | React render component |
| Wrapper fields | `src/fields/wrapperFields.ts` | paddingTop, paddingBottom, background, dividerTop/Bottom |
| Block wrapper | `src/components/BlockWrapper.tsx` | `<section>` → `.edge` → content pattern |
| Link field | `src/fields/linkField.ts` | Internal (relationship) / external (URL) toggle |
| Block registry | `src/blocks/index.ts` | `allBlocks`, `detailBlocks` arrays |
| Block renderer | `src/components/RenderBlocks.tsx` | `blockType` → component mapping |

### Block naming convention
Use concept-number slugs: `m1-page-title`, `m2-hero`, `m3-text-image-split`, etc.

### Example block
```typescript
// src/blocks/Hero.ts
import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const Hero: Block = {
  slug: 'm2-hero',
  labels: { singular: 'M2 Hero', plural: 'M2 Hero' },
  fields: [
    { name: 'headline', type: 'text', required: true, localized: true },
    makeWrapperFields({ paddingTop: 'none', paddingBottom: 'none' }),
  ],
}
```

## Core Components

| Component | Description |
|-----------|------------|
| `BlockWrapper` | Wrapper/Container system — full-width `<section>`, content-width `.edge` |
| `SmartLink` | Auto-icon links (→ internal, ↗ external) from `linkField()` data |
| `PayloadImage` | Next.js `<Image fill>` wrapper with sizes prop |
| `CookieBanner` | GDPR cookie consent (4 categories) |
| `RichText` | Lexical JSON → HTML renderer |
| `SectionHeader` | Label + link row (e.g. "PROGRAMM" + "Alle →") |
| `NavLinks` | Client component with active state via `usePathname()` |
| `MobileMenu` | Portal-based overlay with clip-path animation |

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation, coding conventions, and known pitfalls.

## Tech Stack

- [Payload CMS](https://payloadcms.com/) v3 — Headless CMS
- [Next.js](https://nextjs.org/) 16 — React framework
- [Tailwind CSS](https://tailwindcss.com/) v4 — Utility-first CSS
- [PostgreSQL](https://www.postgresql.org/) — Database
- [Sharp](https://sharp.pixelplumbing.com/) — Image processing

## License

MIT
