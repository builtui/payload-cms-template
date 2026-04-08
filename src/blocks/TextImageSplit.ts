import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'
import { linkField } from '../fields/linkField'

export const TextImageSplit: Block = {
  slug: 'm3-text-image-split',
  labels: { singular: 'M3 Text-Bild Split', plural: 'M3 Text-Bild Splits' },
  fields: [
    { name: 'sectionLabel', type: 'text', localized: true },
    {
      name: 'body',
      type: 'richText',
      required: true,
      localized: true,
    },
    linkField('cta', { label: 'CTA Link' }),
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'imagePosition',
      type: 'select',
      defaultValue: 'right',
      options: [
        { label: 'Bild links', value: 'left' },
        { label: 'Bild rechts', value: 'right' },
      ],
    },
    makeWrapperFields({ paddingBottom: 'lg', dividerTop: true }),
  ],
}
