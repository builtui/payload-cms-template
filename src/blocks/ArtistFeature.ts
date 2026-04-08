import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const ArtistFeature: Block = {
  slug: 'm17a-artist-feature',
  labels: { singular: 'M17a Kuenstler:in Feature', plural: 'M17a Kuenstler:in Features' },
  fields: [
    { name: 'artist', type: 'relationship', relationTo: 'artists', required: true },
    {
      name: 'imagePosition',
      type: 'select',
      defaultValue: 'left',
      options: [
        { label: 'Bild links', value: 'left' },
        { label: 'Bild rechts', value: 'right' },
      ],
    },
    makeWrapperFields({ paddingBottom: 'lg' }),
  ],
}
