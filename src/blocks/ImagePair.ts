import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const ImagePair: Block = {
  slug: 'm9-image-pair',
  labels: { singular: 'M9 Bilderpaar', plural: 'M9 Bilderpaare' },
  fields: [
    { name: 'imageLeft', type: 'upload', relationTo: 'media', required: true },
    { name: 'imageRight', type: 'upload', relationTo: 'media', required: true },
    makeWrapperFields({ paddingBottom: 'md' }),
  ],
}
