import type { Field } from 'payload'

export function linkField(name: string = 'link', opts: { label?: string } = {}): Field {
  return {
    name,
    type: 'group',
    label: opts.label || 'Link',
    fields: [
      {
        name: 'type',
        type: 'radio',
        defaultValue: 'internal',
        options: [
          { label: 'Intern', value: 'internal' },
          { label: 'Extern', value: 'external' },
        ],
        admin: { layout: 'horizontal' },
      },
      {
        name: 'label',
        type: 'text',
        localized: true,
        admin: { width: '100%' },
      },
      {
        name: 'reference',
        type: 'relationship',
        relationTo: ['pages', 'events', 'artists', 'projects'],
        admin: {
          condition: (_, siblingData) => siblingData?.type === 'internal',
        },
      },
      {
        name: 'url',
        type: 'text',
        admin: {
          condition: (_, siblingData) => siblingData?.type === 'external',
          description: 'Vollstaendige URL inkl. https://',
        },
      },
      {
        name: 'newTab',
        type: 'checkbox',
        defaultValue: false,
        admin: {
          condition: (_, siblingData) => siblingData?.type === 'external',
          width: '50%',
        },
      },
    ],
  }
}
