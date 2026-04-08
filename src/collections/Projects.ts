import type { CollectionConfig } from 'payload'
import { detailBlocks } from '../blocks'

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: 'Projekt', plural: 'Projekte' },
  admin: { useAsTitle: 'title', group: 'Inhalte' },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    { name: 'description', type: 'textarea', localized: true },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'externalUrl',
      type: 'text',
      admin: { description: 'Optionaler externer Link' },
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: detailBlocks,
    },
  ],
}
