import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const ArtistMarquee: Block = {
  slug: 'm11-artist-marquee',
  labels: { singular: 'M11 Kuenstler:innen Marquee', plural: 'M11 Kuenstler:innen Marquees' },
  fields: [
    {
      name: 'sectionLabel',
      type: 'text',
      localized: true,
      defaultValue: 'Kuenstler:innen im Haus',
    },
    {
      name: 'linkLabel',
      type: 'text',
      localized: true,
      defaultValue: 'Alle',
    },
    { name: 'linkUrl', type: 'text', defaultValue: '/kuenstlerinnen' },
    makeWrapperFields({ paddingBottom: 'lg', dividerTop: true }),
  ],
}
