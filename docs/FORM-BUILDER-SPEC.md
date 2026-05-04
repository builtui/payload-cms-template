# Form-Builder Spec — Powermail-Äquivalent für Payload

**Status:** Spec / Brainstorm — **nicht implementiert**. Dieses Doc beschreibt
ein zukünftiges Template-Feature, das die manuell-pro-Use-Case gebauten
Form-Blocks (m18-contact-form etc.) durch ein Editor-konfigurierbares Form-
Builder-System ablöst — analog zum TYPO3-Powermail-Plugin.

**Zielgruppe**: jemand, der das Feature in 1-3 Tagen bauen will, wenn der
Bedarf da ist. Spec ist ausreichend detailliert, um direkt nach
[writing-plans](../../README.md) in einen Implementation-Plan zu gehen.

---

## Motivation — Wann lohnt sich der Bau?

Aktuell: jeder Form-Use-Case ist ein eigener Block mit eigenem Schema +
eigenem Render-Component + eigener Submit-Route. Ein Kontaktformular
(`m18-contact-form`) hat fest verdrahtete Felder (name, email, company,
trade-show, …); ein Bewerbungs-Formular wäre ein neuer Block; ein
Survey-Formular wieder einer.

**Build-Schwelle**: Ab dem dritten distinkten Form-Use-Case in *einem*
Projekt — oder dem zweiten Projekt, das ein nicht-trivialen Form braucht —
amortisiert sich der Form-Builder. Vorher sind hardcoded Block-Schemas
billiger.

**Was Powermail (TYPO3) löst, das hier auch gelöst werden soll**:
- Editor erstellt Forms im Admin ohne Developer
- Beliebige Feldtypen (text, email, textarea, select, radio, checkbox, file, date, captcha)
- Per-Field Validierung (required, regex, min/max-Length, file-mime/-size)
- Conditional Logic (Feld B nur sichtbar wenn Feld A einen bestimmten Wert hat)
- Multi-Step / paginierte Forms
- Multiple Recipients mit conditional Routing
- Admin-Notification + User-Confirmation als separate Templates
- Submission-Storage in DB für Auswertung
- DSGVO: Consent-Checkbox, Daten-Retention-Policy

---

## Architektur

```
┌─────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│ Forms Collection    │     │ Form-Block (m??)     │     │ Form-Submissions     │
│ (= Form-Definition) │◄────│ Relationship-Pointer │     │ Collection           │
│                     │     │ auf 1 Form-Doc       │     │ (1 Eintrag pro Submit)│
└─────────────────────┘     └──────────┬───────────┘     └──────────┬───────────┘
                                       │                            │
                                       ▼                            ▼
                          ┌────────────────────────┐    ┌────────────────────────┐
                          │ Generic Form Renderer  │    │ Submit-Route           │
                          │ (1 Component für ALLE  │    │ /api/forms/submit      │
                          │ Form-Typen)            │───►│ - Schema-validation    │
                          │                        │    │ - Persist submission   │
                          └────────────────────────┘    │ - Fire emails per Form │
                                                        │   recipient rules      │
                                                        └────────────────────────┘
```

Drei zentrale Sachen:
1. **`forms` Collection** — Definitionen (Editor managed)
2. **`m??-form` Block** — Page-Einbettung via Relationship
3. **`form-submissions` Collection** — Storage + Audit-Trail

Plus: ein generischer Submit-Endpoint + ein generischer Renderer-Component.

---

## `forms` Collection — Schema

```ts
export const Forms: CollectionConfig = {
  slug: 'forms',
  labels: { singular: 'Formular', plural: 'Formulare' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
    group: 'Inhalte',
  },
  fields: [
    { name: 'name', type: 'text', required: true,
      admin: { description: 'Interner Name (z.B. "Kontakt Allgemein").' } },
    slugField('name'),

    // === Felder ===
    {
      name: 'fields',
      type: 'array',
      labels: { singular: 'Feld', plural: 'Felder' },
      fields: [
        // discriminator
        { name: 'type', type: 'select', required: true, options: [
          { label: 'Text', value: 'text' },
          { label: 'Email', value: 'email' },
          { label: 'Telefon', value: 'tel' },
          { label: 'Zahl', value: 'number' },
          { label: 'Mehrzeiliger Text', value: 'textarea' },
          { label: 'Auswahl (Dropdown)', value: 'select' },
          { label: 'Auswahl (Radio)', value: 'radio' },
          { label: 'Mehrfach-Auswahl (Checkboxen)', value: 'checkboxes' },
          { label: 'Einzel-Checkbox', value: 'checkbox' },
          { label: 'Datei-Upload', value: 'file' },
          { label: 'Datum', value: 'date' },
          { label: 'Versteckt (Hidden)', value: 'hidden' },
          { label: 'Überschrift (kein Feld)', value: 'heading' },
          { label: 'Hinweistext (kein Feld)', value: 'paragraph' },
        ]},

        // identity
        { name: 'name', type: 'text', required: true,
          admin: { description: 'Schlüssel im Submit-Payload (z.B. "email"). Lowercase, keine Leerzeichen.' } },

        // user-facing strings (alle localized)
        { name: 'label', type: 'text', localized: true },
        { name: 'placeholder', type: 'text', localized: true,
          admin: { condition: (_, s) => ['text','email','tel','number','textarea','select'].includes(s.type) } },
        { name: 'helpText', type: 'text', localized: true,
          admin: { description: 'Kleine Hilfe unterhalb des Felds.' } },

        // options for select/radio/checkboxes
        {
          name: 'options',
          type: 'array',
          admin: { condition: (_, s) => ['select','radio','checkboxes'].includes(s.type) },
          fields: [
            { name: 'label', type: 'text', required: true, localized: true },
            { name: 'value', type: 'text', required: true },
          ],
        },

        // validation
        { name: 'required', type: 'checkbox', defaultValue: false },
        { name: 'minLength', type: 'number',
          admin: { condition: (_, s) => ['text','textarea'].includes(s.type) } },
        { name: 'maxLength', type: 'number',
          admin: { condition: (_, s) => ['text','textarea'].includes(s.type) } },
        { name: 'pattern', type: 'text',
          admin: { description: 'Regex (ohne Slashes). Optional.', condition: (_, s) => ['text','tel'].includes(s.type) } },
        { name: 'patternError', type: 'text', localized: true,
          admin: { description: 'Fehlermeldung wenn Regex nicht matcht.', condition: (_, s) => ['text','tel'].includes(s.type) } },

        // file-only
        { name: 'fileMimeTypes', type: 'text',
          admin: { description: 'Comma-separated, z.B. "application/pdf,image/jpeg". Leer = alle.', condition: (_, s) => s.type === 'file' } },
        { name: 'fileMaxSizeMb', type: 'number', defaultValue: 10,
          admin: { condition: (_, s) => s.type === 'file' } },

        // conditional logic — Phase 2, see below
        {
          name: 'showWhen',
          type: 'group',
          label: 'Bedingung (optional)',
          admin: { description: 'Feld nur zeigen wenn Bedingung erfüllt. Leer = immer zeigen.' },
          fields: [
            { name: 'fieldName', type: 'text',
              admin: { description: 'Name eines anderen Felds in diesem Formular.' } },
            { name: 'operator', type: 'select', defaultValue: 'equals',
              options: [
                { label: 'gleich', value: 'equals' },
                { label: 'ungleich', value: 'notEquals' },
                { label: 'enthält', value: 'contains' },
                { label: 'nicht leer', value: 'isSet' },
              ],
            },
            { name: 'value', type: 'text' },
          ],
        },

        // step-grouping for multi-step forms
        { name: 'step', type: 'number', defaultValue: 1,
          admin: { description: 'Welcher Schritt im Multi-Step-Form (1 = erster). Bei 1-Step-Form irrelevant.' } },

        // for "heading" / "paragraph" types — content
        { name: 'staticContent', type: 'richText',
          admin: { condition: (_, s) => ['heading','paragraph'].includes(s.type) } },
      ],
    },

    // === Submission-Behaviour ===
    {
      name: 'submitButton',
      type: 'group',
      fields: [
        { name: 'label', type: 'text', localized: true, defaultValue: 'Senden' },
        { name: 'sendingLabel', type: 'text', localized: true, defaultValue: 'Wird gesendet…' },
      ],
    },
    {
      name: 'success',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', localized: true, defaultValue: 'Vielen Dank' },
        { name: 'body', type: 'richText', localized: true },
        { name: 'redirectTo', type: 'text',
          admin: { description: 'Optional. Wenn gesetzt, wird der User nach Submit hier hin redirected.' } },
      ],
    },

    // === DSGVO ===
    {
      name: 'legal',
      type: 'group',
      fields: [
        { name: 'consentNotice', type: 'richText', localized: true },
        { name: 'consentRequired', type: 'checkbox', defaultValue: true },
        { name: 'consentLabel', type: 'text', localized: true },
        { name: 'retentionDays', type: 'number', defaultValue: 365,
          admin: { description: 'Submissions werden nach so vielen Tagen automatisch gelöscht. 0 = nie löschen.' } },
      ],
    },

    // === Mail-Routing ===
    {
      name: 'recipients',
      type: 'array',
      labels: { singular: 'Empfänger', plural: 'Empfänger-Regeln' },
      admin: { description: 'Wer kriegt die Submission per Mail. Mehrere Empfänger = mehrere Mails. Conditional Routing via "Wenn"-Bedingung.' },
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'name', type: 'text' },
        // conditional routing (same shape as field showWhen)
        {
          name: 'when',
          type: 'group',
          label: 'Nur senden wenn (optional)',
          fields: [
            { name: 'fieldName', type: 'text' },
            { name: 'operator', type: 'select', options: [
              { label: 'gleich', value: 'equals' },
              { label: 'ungleich', value: 'notEquals' },
              { label: 'enthält', value: 'contains' },
            ]},
            { name: 'value', type: 'text' },
          ],
        },
      ],
    },

    // === Templates ===
    {
      name: 'adminTemplate',
      type: 'group',
      label: 'Admin-Notification (an Empfänger)',
      fields: [
        { name: 'subject', type: 'text', localized: true,
          defaultValue: 'Neue Formular-Eingabe: {{form.name}}',
          admin: { description: 'Variablen: {{form.name}}, {{field.NAME}}, {{submission.id}}, {{submission.createdAt}}.' } },
        { name: 'body', type: 'richText', localized: true,
          admin: { description: 'Variablen wie oben. Default: alle Felder als Liste rendern.' } },
      ],
    },
    {
      name: 'userConfirmation',
      type: 'group',
      label: 'Bestätigung an User (optional)',
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: false },
        { name: 'fromFieldName', type: 'text', defaultValue: 'email',
          admin: { description: 'Welches Feld enthält die User-Email-Adresse.' } },
        { name: 'subject', type: 'text', localized: true },
        { name: 'body', type: 'richText', localized: true },
      ],
    },

    // === Anti-Spam ===
    {
      name: 'antispam',
      type: 'group',
      fields: [
        { name: 'honeypotEnabled', type: 'checkbox', defaultValue: true,
          admin: { description: 'Verstecktes Feld; wenn ausgefüllt → Submission silent gedropt.' } },
        { name: 'minSubmitDelayMs', type: 'number', defaultValue: 1500,
          admin: { description: 'Form muss mindestens so lange offen sein bevor Submit akzeptiert wird (Bot-Schutz).' } },
        { name: 'rateLimitPerHour', type: 'number', defaultValue: 5,
          admin: { description: 'Max Submissions pro IP pro Stunde.' } },
      ],
    },
  ],
}
```

---

## `m??-form` Block (z.B. `m25-form`)

Generischer Block, der ein Form-Doc per Relationship referenziert. Schlank,
weil Form-Logik im Form-Doc selbst lebt.

```ts
export const Form: Block = {
  slug: 'm25-form',
  labels: { singular: 'M25 Form', plural: 'M25 Form' },
  fields: [
    { name: 'eyebrow', type: 'text', localized: true },
    { name: 'title', type: 'text', localized: true },
    bodyTextField({ name: 'lede' }),
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      required: true,
      admin: { description: 'Welches Formular soll hier angezeigt werden.' },
    },
    makeWrapperFields({ paddingTop: 'md', paddingBottom: 'xl' }),
  ],
}
```

Renderer (server-component) holt das Form-Doc + reicht es an einen
client-side `<DynamicForm form={...} locale={locale} />` durch.

---

## `form-submissions` Collection

```ts
export const FormSubmissions: CollectionConfig = {
  slug: 'form-submissions',
  labels: { singular: 'Eingang', plural: 'Eingänge' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['form', 'subject', 'status', 'createdAt'],
    group: 'Eingänge',
  },
  defaultSort: '-createdAt',
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => true,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'form', type: 'relationship', relationTo: 'forms', required: true },
    { name: 'subject', type: 'text', admin: { readOnly: true,
      description: 'Auto-derived: Form-Name + erstes Text-Feld als Vorschau.' } },
    {
      name: 'data',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Komplette Submission als JSON: { fieldName: value, … }',
      },
    },
    {
      name: 'attachments',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      admin: { description: 'Hochgeladene Files (für file-Felder).' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'Neu', value: 'new' },
        { label: 'In Bearbeitung', value: 'inProgress' },
        { label: 'Erledigt', value: 'done' },
        { label: 'Spam', value: 'spam' },
      ],
    },
    { name: 'consentGiven', type: 'checkbox', admin: { readOnly: true } },
    { name: 'ip', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'userAgent', type: 'text', admin: { readOnly: true, hidden: true } },
  ],
}
```

**Auto-Cleanup**: ein Cron-Job (oder afterChange-Hook auf dem Form-Doc, der
einen Cleanup-Job dispatcht) löscht Submissions, die älter als
`form.legal.retentionDays` sind.

---

## Submit-Endpoint — `/api/forms/submit`

Single-Endpoint für ALLE Forms. Body: `{ formId, locale, fields: { name: value, … }, honeypot, openedAt }`.

**Pseudo-Logik**:

```ts
export async function POST(req) {
  const body = await req.json()
  const { formId, fields, honeypot, openedAt } = body

  // 1. Anti-Spam
  if (honeypot) return ok()  // silent drop
  if (Date.now() - openedAt < form.antispam.minSubmitDelayMs)
    return error('Too fast', 429)
  if (await rateLimited(ip, form.antispam.rateLimitPerHour))
    return error('Too many requests', 429)

  // 2. Lade Form-Definition
  const form = await payload.findByID({ collection: 'forms', id: formId })

  // 3. Validate every field gegen sein Schema
  const errors = validateFields(form.fields, fields, locale)
  if (Object.keys(errors).length > 0)
    return error({ errors }, 400)

  // 4. File-Uploads (aus form-data multipart) → media-Collection
  const attachments = await uploadFiles(fields, form.fields)

  // 5. Persist
  const submission = await payload.create({
    collection: 'form-submissions',
    data: { form: formId, data: fields, attachments, ip, userAgent, consentGiven, subject: deriveSubject(fields, form) },
  })

  // 6. Mail-Versand pro Recipient (mit conditional Routing)
  for (const recipient of form.recipients) {
    if (recipient.when && !matchesCondition(fields, recipient.when)) continue
    await sendMail({
      to: recipient.email,
      subject: render(form.adminTemplate.subject, { form, fields, submission }),
      html: render(form.adminTemplate.body, { form, fields, submission }),
    })
  }

  // 7. User-Confirmation falls aktiviert
  if (form.userConfirmation.enabled) {
    const userEmail = fields[form.userConfirmation.fromFieldName]
    if (userEmail) await sendMail({
      to: userEmail,
      subject: render(form.userConfirmation.subject, { form, fields }),
      html: render(form.userConfirmation.body, { form, fields }),
    })
  }

  return ok({ id: submission.id, redirectTo: form.success.redirectTo || null })
}
```

---

## Generic Renderer — `<DynamicForm>`

Ein Client-Component der eine Form-Definition + locale akzeptiert und das
gesamte Formular rendert. Field-Type → Render-Function map. Conditional
Logic ausgewertet pro Render-Pass.

```tsx
'use client'

const FIELD_RENDERERS: Record<FieldType, ComponentType<FieldProps>> = {
  text: TextField,
  email: EmailField,
  tel: TelField,
  number: NumberField,
  textarea: TextareaField,
  select: SelectField,
  radio: RadioField,
  checkboxes: CheckboxesField,
  checkbox: CheckboxField,
  file: FileField,
  date: DateField,
  hidden: HiddenField,
  heading: HeadingField,
  paragraph: ParagraphField,
}

export function DynamicForm({ form, locale }: Props) {
  const [values, setValues] = useState<Record<string, any>>({})
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [openedAt] = useState(Date.now())
  // …

  const visibleFields = form.fields.filter(f =>
    f.step === step && evaluateShowWhen(f.showWhen, values),
  )

  return (
    <form onSubmit={…}>
      {visibleFields.map(f => {
        const Renderer = FIELD_RENDERERS[f.type]
        return <Renderer
          key={f.name}
          field={f}
          value={values[f.name]}
          onChange={v => setValues({ ...values, [f.name]: v })}
          error={errors[f.name]}
          locale={locale}
        />
      })}
      {/* Multi-step nav OR single-step submit */}
      {/* Honeypot + DSGVO checkbox */}
    </form>
  )
}
```

---

## Phasen-Plan

Spec ist gross. Sinnvoll in Phasen bauen:

### Phase 1 — MVP (1-2 Tage)
- Forms-Collection mit text/email/textarea/select/checkbox/checkboxes + required + minLength/maxLength
- m??-form Block + DynamicForm-Renderer
- Submit-Endpoint mit Validation + Persist + 1 Recipient
- Honeypot
- Admin-Notification-Mail (1 Template, alle Felder als Liste)

### Phase 2 — Vollständig (2-3 Tage)
- Restliche Field-Types (radio, file, date, hidden, heading, paragraph, tel, number)
- Pattern-Validation
- File-Upload mit Mime/Size-Check
- Multiple Recipients ohne Conditional Routing
- User-Confirmation-Mail
- Conditional Logic (showWhen)
- DSGVO Consent + Retention

### Phase 3 — Premium (3+ Tage)
- Multi-Step-Forms (Step-Navigation, Progress-Indicator, Step-Validation)
- Conditional Recipient-Routing
- Custom-Variablen-Engine in Templates ({{field.NAME}})
- Captcha-Integration (hCaptcha oder Cloudflare Turnstile)
- Admin-UI: Form-Preview im Admin (live render der konfigurierten Form)
- Bulk-Export der Submissions als CSV
- Form-Versionierung (Draft/Published) damit Live-Forms sich nicht
  versehentlich ändern wenn der Editor was anpasst

---

## Was bewusst NICHT im Scope ist

- **Visueller Drag-Drop-Builder** wie bei TYPO3-Powermail. Payload's Array-
  UI mit conditional fields ist klar genug für die meisten Editoren.
  Visueller Builder wäre eine eigene Custom-Admin-Component und ist
  Phase 4-Aufwand.
- **A/B-Testing zwischen Form-Varianten**. Hat noch nie jemand gefragt.
- **CRM-Integration** (HubSpot, Salesforce). Webhook-Output an
  Zapier/n8n + dort weiter — billiger als pro CRM einen eigenen Adapter.
- **Calculation-Logic** (Feld C = Feld A * Feld B). Wenn das gebraucht wird,
  ist es kein Form mehr sondern ein Calculator — eigener Block-Typ.
- **PDF-Export der Submission**. Cron-Job-Alternative oder Workflow-Tool.

---

## Migration vom hardcoded `m18-contact-form`

Wenn das Form-Builder-Feature live ist, **nicht** den bestehenden m18-Block
löschen — er funktioniert. Stattdessen:
1. Eine Form `Kontakt Allgemein` im Admin anlegen, die dieselben Felder hat
2. m18-Block durch m25-Block (mit Verweis auf die neue Form) ersetzen, wo
   der Editor das will
3. m18 als deprecated im Code-Comment markieren, in 6-12 Monaten entfernen

---

## Verwandte Docs

- [LEARNINGS.md §12.1](LEARNINGS.md#121-pflegbarkeitsregel-was-der-editor-sehen-können-muss-lebt-im-cms) —
  warum hardcoded Editor-Strings Schulden sind
- [LEARNINGS.md §12.3](LEARNINGS.md#123-übersetzbarkeit-ist-eine-schema-disziplin-kein-code-patch) —
  warum jedes Editor-Field `localized: true` von Tag 1 braucht
- [AGENCY-STACK.md — Mail](AGENCY-STACK.md#transactional-mail) — welcher
  Mail-Provider die Recipient-Mails verschickt
- [FEATURES.md — Cookie-Consent-Vertrag](FEATURES.md#gdpr-basics) — wie das
  Form-Submit + DSGVO-Checkbox-Pattern in den Banner-Vertrag integriert ist
