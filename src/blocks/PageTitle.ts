import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const PageTitle: Block = {
  slug: 'm1-page-title',
  labels: { singular: 'M1 Seitentitel', plural: 'M1 Seitentitel' },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'subtitle', type: 'text', localized: true },
    {
      name: 'size',
      type: 'select',
      defaultValue: 'large',
      options: [
        { label: 'Gross', value: 'large' },
        { label: 'Mittel', value: 'medium' },
      ],
    },
    makeWrapperFields({ paddingBottom: 'md' }),
  ],
}
