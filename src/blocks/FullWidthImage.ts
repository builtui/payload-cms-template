import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const FullWidthImage: Block = {
  slug: 'm7-full-width-image',
  labels: { singular: 'M7 Vollbild', plural: 'M7 Vollbilder' },
  fields: [
    { name: 'sectionLabel', type: 'text', localized: true },
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    {
      name: 'aspectRatio',
      type: 'select',
      defaultValue: '16/9',
      options: [
        { label: '16:7 (Panorama)', value: '16/7' },
        { label: '16:8 (Breit)', value: '16/8' },
        { label: '16:9 (Standard)', value: '16/9' },
        { label: '2.4:1 (Ultrabreit)', value: '2.4/1' },
      ],
    },
    makeWrapperFields({ paddingBottom: 'sm' }),
  ],
}
