import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const ArtistPair: Block = {
  slug: 'm17b-artist-pair',
  labels: { singular: 'M17b Kuenstler:innen Paar', plural: 'M17b Kuenstler:innen Paare' },
  fields: [
    { name: 'artistLeft', type: 'relationship', relationTo: 'artists', required: true },
    { name: 'artistRight', type: 'relationship', relationTo: 'artists', required: true },
    makeWrapperFields({ paddingBottom: 'lg' }),
  ],
}
