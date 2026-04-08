import type { CollectionConfig } from 'payload'
import { detailBlocks } from '../blocks'

export const Events: CollectionConfig = {
  slug: 'events',
  labels: { singular: 'Veranstaltung', plural: 'Veranstaltungen' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'dateStart', 'status'],
    group: 'Inhalte',
  },
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
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Ausstellung', value: 'ausstellung' },
        { label: 'Workshop', value: 'workshop' },
        { label: 'Performance', value: 'performance' },
        { label: 'Talk', value: 'talk' },
        { label: 'Konzert', value: 'konzert' },
        { label: 'Fuehrung', value: 'fuehrung' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'subtitle', type: 'text', localized: true },
    { name: 'description', type: 'textarea', localized: true },
    {
      name: 'dateStart',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'dateEnd',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'previewImage',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Wird in der Programm-Liste beim Hover angezeigt' },
    },
    { name: 'artists', type: 'relationship', relationTo: 'artists', hasMany: true },
    {
      name: 'admission',
      type: 'text',
      localized: true,
      admin: { description: 'z.B. "Frei", "5 EUR", "Spende"' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'upcoming',
      options: [
        { label: 'Kommend', value: 'upcoming' },
        { label: 'Aktuell', value: 'current' },
        { label: 'Vergangen', value: 'past' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: detailBlocks,
    },
  ],
}
