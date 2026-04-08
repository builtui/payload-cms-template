/**
 * Seed Example — Copy this to seed.ts and adapt for your project.
 *
 * Usage:
 *   cp src/seed.example.ts src/seed.ts
 *   # Edit seed.ts with your content
 *   pnpm seed
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from './payload.config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SEED_ASSETS = path.resolve(__dirname, '../seed-assets')

// ─── Helpers ───

const richText = (...paragraphs: string[]) => ({
  root: {
    type: 'root',
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      children: [{ type: 'text', text, format: 0, mode: 'normal', version: 1 }],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    })),
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

async function uploadFile(payload: any, filename: string, alt: string) {
  const filePath = path.join(SEED_ASSETS, filename)
  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filename).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  return payload.create({
    collection: 'media',
    data: { alt },
    file: { data: buffer, mimetype: mime, name: filename, size: buffer.length },
  })
}

async function seed() {
  const payload = await getPayload({ config })
  console.log('Seeding...\n')

  // ─── Globals ───
  await payload.updateGlobal({
    slug: 'navigation',
    data: {
      items: [
        { label: 'Page 1', url: '/page-1' },
        { label: 'Page 2', url: '/page-2' },
      ],
    },
  })

  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      address: { street: 'Musterstrasse 1', zip: '12345', city: 'Musterstadt' },
      email: 'info@example.com',
      openingHours: 'Mo–Fr, 9–17 Uhr',
    },
  })

  await payload.updateGlobal({
    slug: 'footer',
    data: {
      legalLinks: [
        { label: 'Impressum', url: '/impressum' },
        { label: 'Datenschutz', url: '/datenschutz' },
      ],
    },
  })

  // ─── Upload images (place files in seed-assets/) ───
  // const img = await uploadFile(payload, 'hero.jpg', 'Hero image')

  // ─── Pages ───
  await payload.create({
    collection: 'pages',
    data: {
      title: 'Home',
      slug: 'home',
      layout: [
        {
          blockType: 'm2-hero',
          headline: 'Your Headline Here',
          subtext: 'Your subtext here.',
          wrapper: { paddingTop: 'none', paddingBottom: 'none', background: 'transparent', dividerTop: false, dividerBottom: false },
        },
      ],
    },
  })

  console.log('Seed complete!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
