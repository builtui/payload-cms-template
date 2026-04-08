import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const DetailHeader: Block = {
  slug: 'm15-detail-header',
  labels: { singular: 'M15 Detail-Header', plural: 'M15 Detail-Headers' },
  fields: [
    {
      name: 'backLink',
      type: 'group',
      fields: [
        { name: 'label', type: 'text', localized: true, defaultValue: 'Zurueck' },
        { name: 'url', type: 'text', defaultValue: '/programm' },
      ],
    },
    { name: 'typeLabel', type: 'text', localized: true },
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'subtitle', type: 'text', localized: true },
    {
      name: 'metaItems',
      type: 'array',
      fields: [
        { name: 'text', type: 'text', required: true, localized: true },
        { name: 'muted', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'metaStyle',
      type: 'select',
      defaultValue: 'spread',
      options: [
        { label: 'Nebeneinander (Events)', value: 'spread' },
        { label: 'Inline mit Punkt (Kuenstler)', value: 'inline' },
      ],
    },
    makeWrapperFields({ paddingTop: 'none', paddingBottom: 'none' }),
  ],
}
