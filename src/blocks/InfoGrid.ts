import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const InfoGrid: Block = {
  slug: 'm16b-info-grid',
  labels: { singular: 'M16b Info-Grid', plural: 'M16b Info-Grids' },
  fields: [
    { name: 'sectionLabel', type: 'text', localized: true },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'text', type: 'textarea', required: true, localized: true },
      ],
    },
    makeWrapperFields({ paddingBottom: 'lg' }),
  ],
}
