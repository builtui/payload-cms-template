import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'
import { linkField } from '../fields/linkField'

export const ProseSection: Block = {
  slug: 'm3c-prose-section',
  labels: { singular: 'M3c Prose Section', plural: 'M3c Prose Sections' },
  fields: [
    { name: 'sectionLabel', type: 'text', localized: true },
    {
      name: 'body',
      type: 'richText',
      localized: true,
    },
    linkField('cta', { label: 'CTA Link' }),
    makeWrapperFields({ paddingBottom: 'md' }),
  ],
}
