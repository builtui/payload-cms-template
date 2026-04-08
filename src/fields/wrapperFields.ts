import type { Field } from 'payload'

type WrapperDefaults = {
  paddingTop?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  paddingBottom?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  dividerTop?: boolean
  dividerBottom?: boolean
}

const paddingOptions = [
  { label: 'Kein', value: 'none' },
  { label: 'Klein (sm)', value: 'sm' },
  { label: 'Mittel (md)', value: 'md' },
  { label: 'Gross (lg)', value: 'lg' },
  { label: 'Sehr gross (xl)', value: 'xl' },
]

export function makeWrapperFields(defaults: WrapperDefaults = {}): Field {
  const {
    paddingTop = 'none',
    paddingBottom = 'md',
    dividerTop = false,
    dividerBottom = false,
  } = defaults

  return {
    name: 'wrapper',
    type: 'group',
    admin: {
      condition: () => true,
    },
    fields: [
      {
        name: 'paddingTop',
        type: 'select',
        defaultValue: paddingTop,
        options: paddingOptions,
        admin: { width: '25%' },
      },
      {
        name: 'paddingBottom',
        type: 'select',
        defaultValue: paddingBottom,
        options: paddingOptions,
        admin: { width: '25%' },
      },
      {
        name: 'background',
        type: 'select',
        defaultValue: 'transparent',
        options: [
          { label: 'Transparent', value: 'transparent' },
          { label: 'Warm White', value: 'warm-white' },
          { label: 'Deep Black', value: 'deep-black' },
        ],
        admin: { width: '25%' },
      },
      {
        name: 'dividerTop',
        type: 'checkbox',
        defaultValue: dividerTop,
        admin: { width: '12.5%' },
      },
      {
        name: 'dividerBottom',
        type: 'checkbox',
        defaultValue: dividerBottom,
        admin: { width: '12.5%' },
      },
    ],
  }
}

export const wrapperFields = makeWrapperFields()
