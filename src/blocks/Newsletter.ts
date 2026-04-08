import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const Newsletter: Block = {
  slug: 'm12-newsletter',
  labels: { singular: 'M12 Newsletter', plural: 'M12 Newsletter' },
  fields: [
    {
      name: 'headline',
      type: 'text',
      required: true,
      localized: true,
      defaultValue: 'Auf dem Laufenden bleiben.',
    },
    {
      name: 'description',
      type: 'text',
      localized: true,
      defaultValue: 'Neue Ausstellungen, Workshops und Veranstaltungen direkt ins Postfach.',
    },
    makeWrapperFields({ paddingBottom: 'lg', dividerTop: true }),
  ],
}
