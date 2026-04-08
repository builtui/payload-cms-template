import type { CollectionConfig } from 'payload'
import { artistBlocks } from '../blocks'

export const Artists: CollectionConfig = {
  slug: 'artists',
  labels: { singular: 'Kuenstler:in', plural: 'Kuenstler:innen' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'medium', 'origin'],
    group: 'Inhalte',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'medium',
      type: 'text',
      localized: true,
      admin: { description: 'z.B. Malerei, Bildhauerei, Mixed Media' },
    },
    {
      name: 'origin',
      type: 'text',
      localized: true,
      admin: { description: 'z.B. Spanien, Japan' },
    },
    {
      name: 'inHouseSince',
      type: 'number',
      admin: { description: 'Jahr, z.B. 2024' },
    },
    { name: 'portrait', type: 'upload', relationTo: 'media' },
    { name: 'website', type: 'text' },
    { name: 'instagram', type: 'text' },
    {
      name: 'layout',
      type: 'blocks',
      blocks: artistBlocks,
    },
  ],
}
