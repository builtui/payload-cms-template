import type { Field } from 'payload'
import { slugify } from './slugify'

/**
 * Slug field with auto-generation from a source field.
 *
 * - Auto-generates from source field (default: 'title') if slug is empty
 * - Sanitizes umlauts and special characters via slugify()
 * - Editable: user can override the generated slug
 * - Required + unique
 *
 * Usage:
 *   fields: [
 *     { name: 'title', type: 'text', required: true },
 *     slugField(),              // uses 'title' as source
 *     slugField('name'),        // uses 'name' as source
 *   ]
 */
export function slugField(sourceField: string = 'title'): Field {
  return {
    name: 'slug',
    type: 'text',
    required: true,
    unique: true,
    admin: {
      position: 'sidebar',
      description: `Wird automatisch aus dem Feld "${sourceField}" generiert. Kann manuell angepasst werden.`,
    },
    hooks: {
      beforeValidate: [
        ({ value, siblingData }) => {
          // If user provided a slug, just sanitize it
          if (value) return slugify(String(value))
          // Otherwise, derive from source field
          const source = (siblingData as Record<string, unknown>)?.[sourceField]
          if (typeof source === 'string' && source.length > 0) return slugify(source)
          return value
        },
      ],
    },
  }
}
