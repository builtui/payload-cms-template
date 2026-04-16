import type { CollectionConfig } from 'payload'
import { allBlocks } from '../blocks'
import { slugField } from '../fields/slugField'

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Seite', plural: 'Seiten' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug'],
    group: 'Inhalte',
  },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField('title'),
    {
      name: 'layout',
      type: 'blocks',
      blocks: allBlocks,
    },
  ],
}
