import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Einstellungen',
  admin: { group: 'Einstellungen' },
  fields: [
    {
      name: 'address',
      type: 'group',
      fields: [
        { name: 'street', type: 'text', defaultValue: 'Friedrichsstrasse 25' },
        { name: 'zip', type: 'text', defaultValue: '34117' },
        { name: 'city', type: 'text', defaultValue: 'Kassel' },
      ],
    },
    { name: 'email', type: 'email', defaultValue: 'info@hugenottenhaus-kassel.com' },
    { name: 'openingHours', type: 'text', localized: true, defaultValue: 'Mi–So, 14–19 Uhr' },
    { name: 'instagram', type: 'text' },
    { name: 'facebook', type: 'text' },
    { name: 'featuredEvent', type: 'relationship', relationTo: 'events' },
  ],
}
