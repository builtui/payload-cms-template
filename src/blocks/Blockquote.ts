import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const Blockquote: Block = {
  slug: 'm8-blockquote',
  labels: { singular: 'M8 Zitat', plural: 'M8 Zitate' },
  fields: [
    { name: 'quote', type: 'textarea', required: true, localized: true },
    makeWrapperFields({ paddingBottom: 'md', dividerTop: true }),
  ],
}
