import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const Hero: Block = {
  slug: 'm2-hero',
  labels: { singular: 'M2 Hero', plural: 'M2 Hero' },
  fields: [
    { name: 'headline', type: 'text', required: true, localized: true },
    { name: 'subtext', type: 'text', localized: true },
    makeWrapperFields({ paddingTop: 'none', paddingBottom: 'none' }),
  ],
}
