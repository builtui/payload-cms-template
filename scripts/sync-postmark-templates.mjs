/**
 * One-shot push of `postmark-templates/` (layouts + templates) to a Postmark
 * Server. Idempotent — uses Alias as the natural key, creates if missing,
 * updates if it exists.
 *
 * Why a custom script instead of postmark-cli? The official CLI doesn't
 * handle Layouts (only standard Templates). We need both, and the layout
 * has to be pushed BEFORE any template that references it (otherwise the
 * `LayoutTemplate` field rejects with 422).
 *
 * Usage:
 *   POSTMARK_SERVER_TOKEN=… pnpm exec node scripts/sync-postmark-templates.mjs
 *
 *   Add --dry-run to print what WOULD happen without hitting the API.
 *
 * The Server Token (NOT the Account Token) lives at
 * Postmark → Server → API Tokens → Server API Token. Same token that
 * you put in SMTP_USER / SMTP_PASS in .env.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const TEMPLATES_DIR = path.join(REPO_ROOT, 'postmark-templates')
const REGION = process.env.POSTMARK_REGION || 'eu' // 'eu' or 'us'
const API_BASE = REGION === 'eu' ? 'https://api.postmarkapp.com' : 'https://api.postmarkapp.com'
// Note: Postmark's REST API endpoint is the same for both regions; the Server's
// internal data residency is determined when the Server is created in Postmark
// UI. The REGION env var is here for forward-compatibility / explicit doc only.

const TOKEN = process.env.POSTMARK_SERVER_TOKEN
const DRY_RUN = process.argv.includes('--dry-run')

if (!TOKEN) {
  console.error('ERROR: POSTMARK_SERVER_TOKEN not set.')
  console.error('       Postmark → Server "Boothside" → API Tokens → Server API Token')
  process.exit(1)
}

// ---- helpers ----

async function pmFetch(method, pathSuffix, body) {
  if (DRY_RUN) {
    console.log(`  [dry-run] ${method} ${pathSuffix}${body ? ` (${Object.keys(body).join(', ')})` : ''}`)
    return { dryRun: true }
  }
  const res = await fetch(`${API_BASE}${pathSuffix}`, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`${method} ${pathSuffix} → ${res.status} ${data?.Message || JSON.stringify(data)}`)
  }
  return data
}

async function readFileOrEmpty(p) {
  try { return (await fs.readFile(p, 'utf8')).trim() ? await fs.readFile(p, 'utf8') : '' }
  catch { return '' }
}

async function loadDir(dirPath) {
  const meta = JSON.parse(await fs.readFile(path.join(dirPath, path.basename(dirPath) === 'boothside-layout' ? 'layout.json' : 'template.json'), 'utf8'))
  const html = await readFileOrEmpty(path.join(dirPath, 'content.html'))
  const text = await readFileOrEmpty(path.join(dirPath, 'content.txt'))
  return { meta, html, text }
}

async function findExisting(alias) {
  // GET /templates/{alias} returns 422 (NOT 404) when the template doesn't
  // exist — Postmark uses 422 broadly for "not found / not valid". Other 4xx
  // errors (401 auth, etc.) should propagate so we see them clearly.
  try {
    const found = await pmFetch('GET', `/templates/${encodeURIComponent(alias)}`)
    return found
  } catch (err) {
    const msg = String(err.message)
    if (msg.includes(' 404 ') || msg.includes(' 422 ')) return null
    throw err
  }
}

async function pushOne({ meta, html, text }) {
  const alias = meta.Alias
  if (!alias) throw new Error('meta.Alias is required')
  const existing = await findExisting(alias)
  const payload = {
    Name: meta.Name,
    Alias: alias,
    Subject: meta.Subject,
    HtmlBody: html || undefined,
    TextBody: text || undefined,
    LayoutTemplate: meta.LayoutTemplate,
    TemplateType: meta.TemplateType || 'Standard',
  }
  // Strip undefineds — Postmark rejects null on these fields
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k]

  if (existing) {
    await pmFetch('PUT', `/templates/${encodeURIComponent(alias)}`, payload)
    console.log(`  ✓ Updated: ${alias}`)
  } else {
    await pmFetch('POST', '/templates', payload)
    console.log(`  ✓ Created: ${alias}`)
  }
}

// ---- main ----

console.log(`\nSyncing postmark-templates/ → Postmark API (${API_BASE})${DRY_RUN ? ' [DRY RUN]' : ''}\n`)

// Step 1: layouts FIRST (templates reference them by alias)
const layoutsDir = path.join(TEMPLATES_DIR, 'layouts')
const layoutNames = await fs.readdir(layoutsDir)
console.log('Layouts:')
for (const name of layoutNames) {
  const full = path.join(layoutsDir, name)
  const stat = await fs.stat(full)
  if (!stat.isDirectory()) continue
  const loaded = await loadDir(full)
  await pushOne(loaded)
}

// Step 2: templates
const templatesDir = path.join(TEMPLATES_DIR, 'templates')
const templateNames = await fs.readdir(templatesDir)
console.log('\nTemplates:')
for (const name of templateNames) {
  const full = path.join(templatesDir, name)
  const stat = await fs.stat(full)
  if (!stat.isDirectory()) continue
  const loaded = await loadDir(full)
  await pushOne(loaded)
}

console.log('\nDone.\n')
