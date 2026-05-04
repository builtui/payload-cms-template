# Postmark Templates — Repo as Source of Truth

Pattern für Postmark Transactional Templates, wenn ihr sie als Code im Repo
behalten wollt statt im Postmark-UI zu pflegen. Aus den Boothside-Erfahrungen
2026 destilliert: Layouts + Templates per Script-Sync, Mustachio-bilingual
via inverted-section, bulletproof Button-HTML, base64-Logo-Embedding.

**Wann lohnt es sich**: ab 2+ Templates pro Server oder sobald ihr eine
Brand-Layout-Wrapper-Datei pflegt die mehrere Templates teilt. Bei einem
einzelnen Template reicht das UI direkt.

---

## Architektur

```
postmark-templates/
├── README.md                            ← projekt-spezifische Doku
├── layouts/
│   └── <layout-alias>/
│       ├── layout.json                    Name, Alias, TemplateType: Layout
│       ├── content.html                   HTML wrapper, {{{@content}}} = inject point
│       └── content.txt                    Plain-Text wrapper
└── templates/
    └── <template-alias>/
        ├── template.json                  Name, Alias, Subject, LayoutTemplate
        ├── content.html                   Body-HTML, ohne <html>/<body>
        └── content.txt                    Body als Plain-Text

scripts/sync-postmark-templates.mjs      ← Push-Script (im Template)
```

Jeder Template-Eintrag im Postmark-UI hat in dieser Struktur drei Files —
Metadaten als JSON, HTML-Body, Plain-Text-Body. Layouts haben dieselben
drei Files plus den `{{{@content}}}`-Slot im HTML/Text wo das Template eingefügt
wird.

---

## Sync-Script

Das Template enthält `scripts/sync-postmark-templates.mjs`. Idempotent —
re-runs aktualisieren existierende Aliases via PUT, neue via POST.

**Postmark-API-Quirks** die das Script umfasst:
- Postmark gibt **422 statt 404** zurück wenn ein Template nicht existiert
  → das Script behandelt sowohl 404 als auch 422 als "noch nicht da, anlegen"
- Postmark hat keine native CLI für **Layouts** (nur für Templates) → custom
  Script ist der einzige automatisierte Weg
- Layouts MÜSSEN vor Templates gepusht werden, sonst rejectet Postmark die
  `LayoutTemplate`-Referenz im Template mit 422 → das Script sortiert
  Layouts vor Templates

```bash
# Token aus dem 1Password-Vault, NICHT inline kopieren
POSTMARK_SERVER_TOKEN=$(op read 'op://VAULT/Server-Token-Item/credential') \
  pnpm exec node scripts/sync-postmark-templates.mjs

# Dry-run zum Anschauen ohne API-Calls
POSTMARK_SERVER_TOKEN=… pnpm exec node scripts/sync-postmark-templates.mjs --dry-run
```

---

## Mustachio-Patterns

Postmark nutzt **Mustachio** (Mustache-Variante) für Variablen + Sections.
Wichtige Patterns:

### Variable

```mustache
{{name}}                  Variable inline
{{{rawHtml}}}             Variable, kein Escaping (für rich text)
```

### Section (renders when truthy)

```mustache
{{#showBlock}}Wird gerendert wenn showBlock truthy{{/showBlock}}
```

### Inverted Section (renders when falsy)

```mustache
{{^showBlock}}Wird gerendert wenn showBlock NICHT truthy{{/showBlock}}
```

### Bilingual mit Default-Fallback (das wichtigste Pattern)

Naive Variante: zwei separate Sections, eine pro Sprache.

```mustache
{{#de}}Deutsche Version{{/de}}{{#en}}English version{{/en}}
```

**Problem**: Postmark-UI Preview rendert ohne TemplateModel BEIDE Sections.
Editoren sehen Mischmasch und werden verwirrt. Plus muss der App-Code
jedes Mal exakt eine der beiden Variablen auf `true` setzen, sonst rendert
gar nichts.

**Besser**: Inverted-Section-Pattern mit Default-Sprache.

```mustache
{{#de}}Deutsche Version{{/de}}{{^de}}Default English version{{/de}}
```

- TemplateModel `{de: true}` → Deutsche Version rendert
- TemplateModel ohne `de` (oder `de: false`) → English rendert

Vorteile:
- Postmark-UI-Preview ohne TemplateModel zeigt die Default-Sprache (= EN)
  als sinnvollen Fallback statt Mischmasch
- App-Code setzt `de: true` nur wenn `locale === 'de'`, sonst nichts

App-Side-Pattern:
```ts
TemplateModel: {
  inquirer_name: name,
  ...locale === 'de' ? { de: true } : {},
}
```

---

## HTML-Patterns die in Mails durchhalten

### Bulletproof Button (Table-based)

Inline-block-styled-anchor klingt einfach, bricht aber in Outlook und
einigen Webmails (Buttons rendern dann als reiner Link ohne BG-Fill, oder
schwarze Pille mit unsichtbarem Text). **Bulletproof Pattern** ist eine
Tabelle:

```html
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" bgcolor="#1A1A1A" style="background-color:#1A1A1A;border-radius:999px;">
      <a href="{{action_url}}" target="_blank"
         style="display:inline-block;padding:14px 28px;font-family:Helvetica,Arial,sans-serif;
                font-size:14px;font-weight:600;color:#F5F2ED;text-decoration:none;
                border-radius:999px;">
        <span style="color:#F5F2ED;">Button text →</span>
      </a>
    </td>
  </tr>
</table>
```

Schlüssel-Tricks:
- `bgcolor` als HTML-Attribut UND `background-color` inline → Outlook
  fallback
- `<span style="color:...">` um den Text wrappen → Yahoo/Hotmail-Override
  abfangen
- `border-radius` auf TD UND auf Anchor

### Logo embedding

Drei Optionen, jede mit Trade-offs:

| | Hosted URL | Base64 inline | CID-attached |
|---|---|---|---|
| Server-Abhängigkeit | ja, Bilder müssen serviert werden | nein | per-send |
| Email-Größe | klein | +25-30% (base64-overhead) | klein |
| Outlook-Desktop | ✓ | meist ✓, aber inkonsistent ältere Versionen | ✓ |
| Email-Cache | ja, Image-Loader ans Werk | nein | nein |
| Setup-Komplexität | low | none | medium |

Empfehlung für Boothside-Größe: **base64 inline für Logos in Layout-Headers**.
Self-contained Email, kein deploy-blocking Pre-Req. Konvertierung:

```bash
sips -Z 280 logo.png --out logo-email.png    # auf 280px breit resizen
base64 -i logo-email.png > logo.base64.txt   # als base64 dumpen
# Inhalt in <img src="data:image/png;base64,...">
```

Für Body-Bilder (Hero-Image in Newsletter etc.): hosted URL → kleinerer
Email-Size, schnellere Inbox-Anzeige.

### Cross-Client Tipps

- **Web-safe Fonts only** im Mail. Custom Webfonts laden in Gmail / Outlook
  nicht. Alt-Stack `'Helvetica Neue', Helvetica, Arial, sans-serif`.
- **Inline CSS** ist Pflicht (Postmark inlinet automatisch via Premailer
  beim Send, aber von vornherein inline schreiben spart Debugging-Surprise).
- **`<table role="presentation">`** für Layout (kein semantisches Table für
  Layout-Zwecke, role disclaimt das).
- **`color-scheme: light only`** Meta-Tag verhindert dass Email-Clients
  brand-konforme warm-bg + dark-text auto-invertieren in Dark-Mode-Modus.
- **Dark-Mode-Override** ist Lottery — manche Clients respektieren `prefers-color-scheme`,
  manche überschreiben. Sicherste Variante: `meta name="color-scheme" content="light only"`
  + nicht versuchen Dark-Mode separat zu stylen.

---

## Message Streams: Pro-Klasse-Routing

Postmark trennt Mails in **Streams** innerhalb eines Servers. Default ist
`outbound` (transactional default) und `broadcast` (Newsletter/Marketing).
Custom Streams für andere transactional Klassen sinnvoll.

**Pattern für Boothside-Stack**:

| Stream | Wer triggert | Beispiele |
|---|---|---|
| `outbound` (default) | Payload-Auth | Password-Reset, Verify-Email, Magic-Link |
| `notifications` (custom) | App-Code | Form-Submission-Notification, Order-Confirm |

Vorteile pro-Klasse:
- **Suppression-Listen getrennt** — Spam-Complaint auf einer Form-Mail
  sperrt nicht den Auth-Pfad für denselben Empfänger
- **Reputations-Pools getrennt** — wenn ein Stream Bounces hat, betrifft
  das den anderen nicht
- **Activity-Filtering** im Postmark-UI ein Klick statt Subject-Suche
- **Pro-Stream-Webhooks** wenn ihr unterschiedlich reagieren wollt
  (Bounce auf Auth → page someone, Bounce auf Notification → log only)

### Stream im Code via SMTP

`@payloadcms/email-nodemailer` mit Postmark-SMTP nimmt `headers` mit. Der
`X-PM-Message-Stream`-Header wählt den Stream. Default ohne Header ist
`outbound`.

```ts
await payload.sendEmail({
  to: contactEmail,
  from: 'noreply@example.com',
  subject: 'New inquiry',
  html: '...',
  headers: { 'X-PM-Message-Stream': 'notifications' },
})
```

`payload.sendEmail()` → nodemailer → Postmark-SMTP → liest den Header →
routet auf den Custom-Stream. No-op wenn nicht-Postmark-Provider (header
wird einfach im RFC822-Header übergeben, ignoriert von Provider die das
nicht kennen).

### Stream im Code via Postmark-SDK

Wenn ihr von SMTP auf das `postmark`-npm-Package umsteigt (nötig für
TemplateAlias-Sends), wird Stream zum expliziten Field:

```ts
await pm.sendEmailWithTemplate({
  TemplateAlias: 'form-inquiry-notification',
  TemplateModel: { ... },
  From: 'noreply@example.com',
  To: contactEmail,
  ReplyTo: inquirerEmail,
  MessageStream: 'notifications',
})
```

---

## Payload Auth (forgotPassword) mit Brand-Template

Payload's eingebauter `forgotPassword`-Flow ruft den konfigurierten
Email-Adapter auf — bei euch typisch `nodemailerAdapter` über SMTP.
Wenn ihr trotzdem die Brand-konsistenten Postmark-Templates nutzen
wollt (wegen Layout, Logo, Tonalität), gibt es zwei Pfade:

### Pfad A: Lokaler Render durch Payload's Adapter (empfohlen)

Payload's `auth.forgotPassword.generateEmailHTML` returniert den
HTML-String, den der Adapter dann sendet. Statt eine eigene
Boilerplate-HTML zu schreiben, lokal die Postmark-Template-Files
mit Mustache rendern und das Ergebnis zurückgeben:

```ts
// src/collections/Users.ts
import type { CollectionConfig } from 'payload'
import { renderPostmarkTemplate } from '@/lib/postmarkTemplate'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    forgotPassword: {
      generateEmailHTML: async (args) => {
        const token = (args as any)?.token
        const user = (args as any)?.user
        if (!token) return ''
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
        const reset_url = `${baseUrl}/admin/reset/${token}`
        const { html } = await renderPostmarkTemplate('password-reset', {
          reset_url,
          recipient_name: user?.firstName || '',
        })
        return html
      },
      generateEmailSubject: async () => {
        const { subject } = await renderPostmarkTemplate('password-reset', {})
        return subject
      },
    },
  },
  // …
}
```

`renderPostmarkTemplate` (Helper im Template-Repo nicht enthalten,
muss pro Projekt in `src/lib/` gebaut werden) lädt das Template +
Layout aus `postmark-templates/` und rendert mit Mustache.js. Der
gerenderte HTML-String geht an Payload, Payload sendet via Adapter,
**eine** Mail kommt beim User an.

Vorteile:
- Eine einzige Send-Mechanik (= alles über Payload's Adapter)
- Payload's Auth-Flow bleibt kanonisch, kein Custom-Endpoint nötig
- Templates bleiben single-source-of-truth (postmark-templates/)

### Pfad B: Auth via API statt SMTP (= Custom-Endpoint)

Wenn ihr SMTP komplett vermeiden wollt (Attack-Surface, keine
Server-side-SMTP-aktivierung erforderlich), könnt ihr Payload's
Default-Auth-Mail abdrehen und einen eigenen Endpoint bauen:

```ts
// src/app/api/auth/forgot-password/route.ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendPostmarkTemplate } from '@/lib/postmarkTemplate'

export async function POST(req: Request) {
  const { email } = await req.json()
  const payload = await getPayload({ config })
  const result = await payload.forgotPassword({
    collection: 'users',
    data: { email },
    disableEmail: true,           // ← suppress Payload's eigene Mail
  })
  if (!result?.token) {
    return NextResponse.json({ ok: true })   // pretend success → user-enumeration-Schutz
  }
  await sendPostmarkTemplate(
    'password-reset',
    { reset_url: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/reset/${result.token}` },
    { to: email },
  )
  return NextResponse.json({ ok: true })
}
```

Plus: das Admin-Login-UI muss diesen Endpoint statt
`/api/users/forgot-password` aufrufen — was bei Payload's
Default-Admin nicht trivial ist (Override des Login-Forms nötig).

**Wann was?** Pfad A wenn SMTP eh aktiv ist (z.B. Postmark mit
SMTP-API enabled). Pfad B wenn SMTP bewusst aus (Attack-Surface
oder ihr habt kein Custom-Domain-SMTP-Setup).

---

## Reply-To: häufig vergessen, oft nützlich

Form-Submission-Notifications gehen typisch an `hello@example.com`. Wenn
das Team aus der Inbox auf "Antworten" klickt, soll die Antwort beim
Inquirer landen — nicht bei `noreply@`. Lösung: `Reply-To`-Header auf die
Inquirer-Email setzen.

```ts
await payload.sendEmail({
  to: contactEmail,                   // hello@example.com
  from: 'noreply@example.com',
  replyTo: body.email,                // ← der Inquirer
  subject: '...',
  ...
})
```

Bei Postmark-SDK heißt das Feld `ReplyTo` (camelCase, kein Bindestrich).

Als Konvention dokumentieren:
- Internal-Notifications (an Team-Inbox) → `replyTo: <inquirer-email>`
- User-Confirmations (an Inquirer) → kein replyTo (oder explizit `hello@`
  wenn ihr Antworten auf Confirmations sammelt)
- System-Mails (Reset, Verify) → kein replyTo (System-Mail, Antwort
  macht keinen Sinn)

---

## Verwandte Docs

- [AGENCY-STACK.md — Transactional Mail](AGENCY-STACK.md#transactional-mail) —
  Provider-Wahl, Setup-Reihenfolge, Setup-Snippets
- [LEARNINGS.md §12.5 — Tracking-Consent als Event-Vertrag](LEARNINGS.md#125-tracking-consent-als-event-vertrag-nicht-als-if-chain) —
  Cookie-Banner und Tracker entkoppeln (verwandtes Decoupling-Pattern)
- [KNOWN-ISSUES.md — Editor zeigt keine Toolbar](KNOWN-ISSUES.md#richtext-editor-zeigt-keine-toolbar-kein-link--bold--slash-menü) —
  Lexical-Features und ihre Default-vs-explizite Definition
- [scripts/sync-postmark-templates.mjs](../scripts/sync-postmark-templates.mjs)

---

## Pflege

Wenn ihr Mustachio-Quirks neu trefft, neue Cross-Client-Falls findet, oder
Postmark-API-Änderungen merkt — hier nachtragen. Die KNOWN-ISSUES für
Mail-spezifische Symptome ist KNOWN-ISSUES.md (im Bereich "Mail / Postmark");
Pattern-Erklärungen kommen hier rein.
