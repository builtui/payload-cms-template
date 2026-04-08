import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'
import { linkField } from '../fields/linkField'

export const FeaturedExhibition: Block = {
  slug: 'm5-featured-exhibition',
  labels: { singular: 'M5 Aktuelle Ausstellung', plural: 'M5 Aktuelle Ausstellungen' },
  fields: [
    { name: 'sectionLabel', type: 'text', localized: true, defaultValue: 'Aktuelle Ausstellung' },
    { name: 'artistName', type: 'text', required: true, localized: true },
    { name: 'exhibitionTitle', type: 'text', required: true, localized: true },
    { name: 'description', type: 'textarea', localized: true },
    { name: 'dateRange', type: 'text', localized: true, admin: { description: 'z.B. "18. April – 15. Juni 2026"' } },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'imagePosition',
      type: 'select',
      defaultValue: 'left',
      options: [
        { label: 'Bild links', value: 'left' },
        { label: 'Bild rechts', value: 'right' },
      ],
    },
    linkField('cta', { label: 'CTA Link' }),
    makeWrapperFields({ paddingBottom: 'lg', dividerTop: true }),
  ],
}
