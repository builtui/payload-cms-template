import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const DataList: Block = {
  slug: 'm3e-data-list',
  labels: { singular: 'M3e Datenliste', plural: 'M3e Datenlisten' },
  fields: [
    { name: 'sectionLabel', type: 'text', localized: true },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'value', type: 'text', required: true, localized: true },
      ],
    },
    {
      name: 'alignment',
      type: 'select',
      defaultValue: 'left',
      options: [
        { label: 'Links (Standard)', value: 'left' },
        { label: 'Rechts (am Sidebar-Rand)', value: 'right' },
      ],
    },
    makeWrapperFields({ paddingBottom: 'lg', dividerTop: true }),
  ],
}
