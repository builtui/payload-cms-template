import type { GlobalConfig } from 'payload'

export const Footer: GlobalConfig = {
  slug: 'footer',
  label: 'Footer',
  admin: { group: 'Einstellungen' },
  fields: [
    {
      name: 'sponsorLabel',
      type: 'text',
      localized: true,
      defaultValue: 'Gefoerdert durch',
    },
    { name: 'sponsorLogo', type: 'upload', relationTo: 'media' },
    {
      name: 'legalLinks',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ],
}
