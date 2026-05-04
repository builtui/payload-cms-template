/**
 * Helpers for the Postmark templates that live in /postmark-templates/.
 *
 * Two ways to fire one of those templates:
 *
 * 1. `sendPostmarkTemplate(alias, model, opts)` — uses the Postmark API
 *    directly. Postmark renders the template server-side and delivers.
 *    Best for app-driven sends (form submissions, custom transactional).
 *
 * 2. `renderPostmarkTemplate(alias, model)` — renders the template + its
 *    layout LOCALLY using Mustache.js, returns { subject, html, text }.
 *    Then you hand the rendered output to whatever email adapter you
 *    have. Used for Payload-internal flows like `forgotPassword` where
 *    we can't easily intercept the send to use Postmark's API directly,
 *    so we inject brand-rendered HTML into Payload's existing send path.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import Mustache from 'mustache'
import { ServerClient } from 'postmark'

const TEMPLATES_ROOT = path.join(process.cwd(), 'postmark-templates')

let cachedClient: ServerClient | null = null
function client(): ServerClient {
  if (cachedClient) return cachedClient
  const token = process.env.POSTMARK_SERVER_TOKEN
  if (!token) {
    throw new Error('POSTMARK_SERVER_TOKEN missing — set it in .env')
  }
  cachedClient = new ServerClient(token)
  return cachedClient
}

type SendOpts = {
  from?: string
  to: string
  replyTo?: string
  messageStream?: string
  cc?: string
  bcc?: string
}

/**
 * Server-side template send via Postmark API. Postmark resolves the
 * Layout + Template + Mustachio-substitution before delivering.
 */
export async function sendPostmarkTemplate(
  alias: string,
  model: Record<string, unknown>,
  opts: SendOpts,
): Promise<void> {
  const from = opts.from ?? process.env.SMTP_FROM ?? 'noreply@boothside.com'
  await client().sendEmailWithTemplate({
    From: from,
    To: opts.to,
    Cc: opts.cc,
    Bcc: opts.bcc,
    ReplyTo: opts.replyTo,
    TemplateAlias: alias,
    TemplateModel: model,
    MessageStream: opts.messageStream ?? 'outbound',
  })
}

/**
 * Local render of a Postmark template (template + layout, with the
 * subject from template.json). Used when we need the HTML/text to hand
 * off to a different sender (= Payload's auth-flow internal sendEmail).
 *
 * Mustachio's {{{@content}}} placeholder in the layout is handled by
 * substituting the rendered template body before the layout itself
 * goes through Mustache.render().
 */
export async function renderPostmarkTemplate(
  alias: string,
  model: Record<string, unknown>,
): Promise<{ subject: string; html: string; text: string }> {
  const tmplDir = path.join(TEMPLATES_ROOT, 'templates', alias)
  const tmplJson = JSON.parse(await fs.readFile(path.join(tmplDir, 'template.json'), 'utf-8'))
  const tmplHtml = await fs.readFile(path.join(tmplDir, 'content.html'), 'utf-8')
  const tmplText = await fs.readFile(path.join(tmplDir, 'content.txt'), 'utf-8')

  const subject = Mustache.render(tmplJson.Subject ?? '', model)
  const innerHtml = Mustache.render(tmplHtml, model)
  const innerText = Mustache.render(tmplText, model)

  const layoutAlias: string | undefined = tmplJson.LayoutTemplate
  if (!layoutAlias) {
    return { subject, html: innerHtml, text: innerText }
  }

  const layoutDir = path.join(TEMPLATES_ROOT, 'layouts', layoutAlias)
  const layoutHtml = await fs.readFile(path.join(layoutDir, 'content.html'), 'utf-8')
  const layoutText = await fs.readFile(path.join(layoutDir, 'content.txt'), 'utf-8')

  // Postmark's {{{@content}}} placeholder — splice in the rendered template
  // body BEFORE running the layout through Mustache.render so any model
  // variables outside the slot still resolve.
  const layoutHtmlSpliced = layoutHtml.replace(/\{\{\{@content\}\}\}/g, innerHtml)
  const layoutTextSpliced = layoutText.replace(/\{\{\{@content\}\}\}/g, innerText)

  return {
    subject,
    html: Mustache.render(layoutHtmlSpliced, model),
    text: Mustache.render(layoutTextSpliced, model),
  }
}
