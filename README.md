# Payload CMS Module Template

A production-ready Payload CMS + Next.js template with a modular block architecture, GDPR compliance, and smart content editing features.

## Features

- **20+ Content Blocks** — Hero, Text-Image Split, Gallery Grid, Event List, Newsletter, Video Embed, and more
- **Wrapper/Container System** — Consistent spacing architecture where modules sit 0px apart and spacing is controlled through inner padding
- **Smart Links** — Internal links via relationship picker (no manual slug typing), external links with auto-icon selection
- **GDPR Cookie Banner** — 4 categories (Necessary, Analytics, Marketing, External Media) with video consent gate
- **Image Optimization** — Auto WebP conversion, responsive sizes (thumbnail, card, hero), Next.js Image support
- **SEO Plugin** — Meta title, description, image on all content collections
- **Live Preview** — Preview content changes in real-time with responsive breakpoints
- **i18n** — German (default) + English with fallback
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
- `public/images/` — Logos, static images

### 3. Content Structure
- **Collections**: `src/collections/` — Adapt fields for your content types
- **Blocks**: `src/blocks/` — Add/remove modules, update `index.ts` block arrays
- **Routes**: `src/app/(frontend)/` — Adjust URL structure

### 4. Seed Data
```bash
cp src/seed.example.ts src/seed.ts
# Edit with your content
pnpm seed
```

## Block System

| Module | Description |
|--------|------------|
| M1 Page Title | Large responsive headlines (2 sizes) |
| M2 Hero | Typographic hero with flowing headline |
| M3 Text-Image Split | 12-column grid with text + image (left/right toggle) |
| M3c Prose Section | Label + body text (2+6 grid) |
| M3d Body + Sidebar | Body text + key-value sidebar |
| M3e Data List | Label + tabular list |
| M3f Video Embed | YouTube/Vimeo with cookie consent gate |
| M4 Event List | Events from DB with large date numbers |
| M5 Featured Exhibition | Structured exhibition teaser |
| M6 Gallery Grid | Image grid with 4 row presets |
| M7 Full Width Image | Full-width image with selectable aspect ratio |
| M8 Blockquote | Display-size quote |
| M9 Image Pair | Two images side by side |
| M10 Project Cards | Project cards from DB |
| M11 Artist Marquee | Scrolling names with cursor-following portraits |
| M12 Newsletter | Signup form |
| M15 Detail Header | Back link + title + meta (2 styles) |
| M16 Key Info | Address/hours/contact from site settings |
| M16b Info Grid | Label + 2x2 info grid |
| M17a Artist Feature | Artist highlight with image |
| M17b Artist Pair | Two artists side by side |

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
