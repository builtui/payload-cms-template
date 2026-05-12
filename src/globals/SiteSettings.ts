import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Einstellungen',
  admin: { group: 'Einstellungen' },
  fields: [
    { name: 'siteName', type: 'text', admin: { description: 'Wird im Copyright und Meta-Tags verwendet (Brand-Name in <title> Tags)' } },
    {
      name: 'defaultOgImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Fallback OG-Image für Seiten ohne eigenes Cover oder meta.image. Empfohlen: 1200×630 px, < 1 MB. Wird in lib/seo.ts als letzter Fallback verwendet.',
      },
    },
    { name: 'legalEntity', type: 'text', admin: { description: 'Rechtsträger (z.B. für Impressum)' } },
    { name: 'partner', type: 'text', localized: true },
    {
      name: 'address',
      type: 'group',
      fields: [
        { name: 'street', type: 'text' },
        { name: 'zip', type: 'text' },
        { name: 'city', type: 'text' },
      ],
    },
    { name: 'email', type: 'email' },
    { name: 'openingHours', type: 'text', localized: true },
    { name: 'instagram', type: 'text' },
    { name: 'facebook', type: 'text' },
    {
      name: 'analyticsId',
      type: 'text',
      admin: {
        description:
          'Google Analytics 4 Measurement ID (z.B. G-XXXXXXXXXX). Leer lassen = kein Tracking. Wird erst nach Cookie-Zustimmung geladen — siehe Analytics-Component.',
      },
    },
  ],
}
