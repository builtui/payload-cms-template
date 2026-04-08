import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const VideoEmbed: Block = {
  slug: 'm3f-video-embed',
  labels: { singular: 'M3f Video', plural: 'M3f Videos' },
  fields: [
    { name: 'sectionLabel', type: 'text', localized: true },
    {
      name: 'url',
      type: 'text',
      required: true,
      admin: { description: 'YouTube oder Vimeo URL (z.B. https://www.youtube.com/watch?v=...)' },
    },
    {
      name: 'posterImage',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Vorschaubild das vor Cookie-Consent angezeigt wird' },
    },
    { name: 'caption', type: 'text', localized: true },
    makeWrapperFields({ paddingBottom: 'md' }),
  ],
}
