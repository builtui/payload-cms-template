import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const GalleryGrid: Block = {
  slug: 'm6-gallery-grid',
  labels: { singular: 'M6 Galerie-Grid', plural: 'M6 Galerie-Grids' },
  fields: [
    {
      name: 'rows',
      type: 'array',
      fields: [
        {
          name: 'preset',
          type: 'select',
          required: true,
          defaultValue: '2-asymmetric',
          options: [
            { label: '1 Bild (volle Breite)', value: '1-full' },
            { label: '2 Bilder (asymmetrisch)', value: '2-asymmetric' },
            { label: '2 Bilder (symmetrisch)', value: '2-symmetric' },
            { label: '3 Bilder (gleich)', value: '3-equal' },
          ],
        },
        {
          name: 'images',
          type: 'array',
          maxRows: 3,
          fields: [
            { name: 'image', type: 'upload', relationTo: 'media', required: true },
            { name: 'title', type: 'text', localized: true },
            { name: 'caption', type: 'text', localized: true },
          ],
        },
      ],
    },
    makeWrapperFields({ paddingBottom: 'lg', dividerTop: true }),
  ],
}
