import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const KeyInfoBlock: Block = {
  slug: 'm16-key-info',
  labels: { singular: 'M16 Key-Info Block', plural: 'M16 Key-Info Blocks' },
  fields: [
    { name: 'showMap', type: 'checkbox', defaultValue: true },
    { name: 'showDirections', type: 'checkbox', defaultValue: true },
    {
      name: 'directions',
      type: 'richText',
      localized: true,
      admin: {
        condition: (_, siblingData) => siblingData?.showDirections,
      },
    },
    { name: 'accessibility', type: 'richText', localized: true },
    makeWrapperFields({ paddingBottom: 'lg' }),
  ],
}
