/**
 * One-off script: regenerate Sharp size variants for every existing media
 * document. Idempotent — re-uploads each image through Payload's API which
 * triggers the standard upload pipeline (creates the missing variants on disk
 * + updates the doc.sizes field).
 *
 * Run after adding a new entry to Media.imageSizes for legacy uploads to pick
 * up the new variant. New uploads going forward get all variants automatically.
 *
 * Usage (from repo root):
 *   pnpm exec node scripts/regenerate-image-sizes.mjs
 *
 * On prod:
 *   ssh HOST 'sudo -u APP_USER -i bash -c "cd REPO_DIR && pnpm exec node scripts/regenerate-image-sizes.mjs"'
 *
 * Skips video uploads (mimeType video/*) — Sharp variants are image-only.
 *
 * NOTE on CDN cache: re-generated files keep the same URL → Bunny / your CDN
 * serves the cached old version until TTL. Either purge specific URLs in
 * the CDN dashboard after regen, or extend this script with a Purge-API call.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'

const MEDIA_DIR = process.env.MEDIA_DIR || 'media'

const payload = await getPayload({ config })

const { docs } = await payload.find({
  collection: 'media',
  limit: 500,
  depth: 0,
})

console.log(`Found ${docs.length} media docs.`)

let processed = 0
let skipped = 0
let failed = 0

for (const doc of docs) {
  const isImage = doc.mimeType?.startsWith('image/')
  if (!isImage) {
    skipped++
    continue
  }

  const sourcePath = path.join(MEDIA_DIR, doc.filename)
  let buffer
  try {
    buffer = await fs.readFile(sourcePath)
  } catch (err) {
    console.warn(`  ⚠ ${doc.filename}: source not found (${sourcePath}) — skipping`)
    failed++
    continue
  }

  try {
    await payload.update({
      collection: 'media',
      id: doc.id,
      file: {
        data: buffer,
        mimetype: doc.mimeType,
        name: doc.filename,
        size: buffer.length,
      },
    })
    processed++
    if (processed % 5 === 0) console.log(`  ${processed} done…`)
  } catch (err) {
    console.error(`  ✗ ${doc.filename}: ${err.message}`)
    failed++
  }
}

console.log(`\nDone. processed=${processed} skipped(video)=${skipped} failed=${failed}`)
process.exit(0)
