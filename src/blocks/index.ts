import type { Block } from 'payload'

/**
 * Block Registry
 *
 * Import your block definitions here and add them to the arrays below.
 *
 * Example:
 *   import { Hero } from './Hero'
 *   import { PageTitle } from './PageTitle'
 *
 *   const baseAllBlocks: Block[] = [Hero, PageTitle]
 *   export const allBlocks = baseAllBlocks.map(withRowLabel)
 *
 * Wrapping with withRowLabel() gives every block a custom admin header that
 * shows the "Ausgeblendet" indicator when wrapper.hidden is toggled on.
 * Skip the wrapper if you don't want the hidden-toggle UX for a given block.
 */

/**
 * Applies the shared BlockRowLabel component to a Block definition so the
 * admin row label reflects the `wrapper.hidden` state + block-type + summary.
 *
 * Remember to run `pnpm generate:importmap` after adding a Block that uses
 * this helper for the first time.
 */
export function withRowLabel(block: Block): Block {
  return {
    ...block,
    admin: {
      ...block.admin,
      components: {
        ...block.admin?.components,
        // Payload v3 Block API: `Label` customizes the block's header label.
        // (Don't confuse with `RowLabel` — that's only for type:'array' fields.)
        Label: '@/admin/BlockRowLabel#BlockRowLabel',
      },
    },
  }
}

// All blocks — for Pages collection (full flexibility)
export const allBlocks: Block[] = []

// Detail page blocks — for detail pages (Event, Project, etc.)
export const detailBlocks: Block[] = []
