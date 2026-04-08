import type { Block } from 'payload'
import { makeWrapperFields } from '../fields/wrapperFields'

export const EventList: Block = {
  slug: 'm4-event-list',
  labels: { singular: 'M4 Event-Liste', plural: 'M4 Event-Listen' },
  fields: [
    {
      name: 'sectionLabel',
      type: 'text',
      localized: true,
      defaultValue: 'Programm',
    },
    {
      name: 'linkLabel',
      type: 'text',
      localized: true,
      defaultValue: 'Alle Veranstaltungen',
    },
    { name: 'linkUrl', type: 'text', defaultValue: '/programm' },
    { name: 'limit', type: 'number', defaultValue: 4 },
    makeWrapperFields({ paddingTop: 'sm', paddingBottom: 'xl' }),
  ],
}
