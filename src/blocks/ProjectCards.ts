import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const ProjectCards: Block = {
  slug: 'm10-project-cards',
  labels: { singular: 'M10 Projekt-Karten', plural: 'M10 Projekt-Karten' },
  fields: [
    {
      name: 'sectionLabel',
      type: 'text',
      localized: true,
      defaultValue: 'Projekte',
    },
    {
      name: 'linkLabel',
      type: 'text',
      localized: true,
      defaultValue: 'Alle Projekte',
    },
    { name: 'linkUrl', type: 'text', defaultValue: '/projekte' },
    { name: 'limit', type: 'number', defaultValue: 3 },
    makeWrapperFields({ paddingBottom: 'lg', dividerTop: true }),
  ],
}
