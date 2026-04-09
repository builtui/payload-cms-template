import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Einstellungen',
  admin: { group: 'Einstellungen' },
  fields: [
    { name: 'siteName', type: 'text', admin: { description: 'Wird im Copyright und Meta-Tags verwendet' } },
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
  ],
}
