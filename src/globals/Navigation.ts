import type { GlobalConfig } from 'payload'

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Navigation',
  admin: { group: 'Einstellungen' },
  fields: [
    {
      name: 'items',
      type: 'array',
      maxRows: 8,
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        {
          name: 'url',
          type: 'text',
          required: true,
          admin: { description: 'z.B. /programm, /das-haus' },
        },
      ],
    },
  ],
}
