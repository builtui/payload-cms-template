import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const BodySidebar: Block = {
  slug: 'm3d-body-sidebar',
  labels: { singular: 'M3d Body + Sidebar', plural: 'M3d Body + Sidebars' },
  fields: [
    {
      name: 'body',
      type: 'richText',
      required: true,
      localized: true,
    },
    {
      name: 'sidebarItems',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'value', type: 'text', required: true, localized: true },
      ],
    },
    makeWrapperFields({ paddingBottom: 'md' }),
  ],
}
