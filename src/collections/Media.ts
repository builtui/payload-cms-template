import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Medium', plural: 'Medien' },
  access: { read: () => true },
  admin: {
    defaultColumns: ['filename', 'folder', 'alt', 'updatedAt'],
    listSearchableFields: ['alt', 'filename', 'folder'],
  },
  upload: {
    staticDir: 'media',
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 768, height: 576, position: 'centre' },
      { name: 'hero', width: 1920, height: undefined, position: 'centre' },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*'],
    formatOptions: {
      format: 'webp',
      options: { quality: 82 },
    },
  },
  fields: [
    { name: 'alt', type: 'text', required: true, localized: true },
    {
      name: 'folder',
      type: 'select',
      admin: {
        position: 'sidebar',
        description: 'Ordner zur Organisation der Medien',
      },
      options: [
        { label: 'Allgemein', value: 'allgemein' },
        { label: 'Kuenstler:innen', value: 'kuenstlerinnen' },
        { label: 'Veranstaltungen', value: 'veranstaltungen' },
        { label: 'Projekte', value: 'projekte' },
        { label: 'Das Haus', value: 'das-haus' },
        { label: 'Logos & Icons', value: 'logos' },
      ],
    },
  ],
}
