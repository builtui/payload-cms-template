import React from 'react'

/**
 * Block Renderer — maps blockType slugs to React components.
 *
 * Add your block components here:
 *
 *   import { HeroBlock } from '@/components/blocks/HeroBlock'
 *
 *   const blockComponents: Record<string, React.ComponentType<any>> = {
 *     'm2-hero': HeroBlock,
 *   }
 *
 * Blocks with `wrapper.hidden === true` are filtered out and NOT rendered
 * (the block stays in the DB so the editor can toggle it back on later).
 * See src/fields/wrapperFields.ts for the `hidden` field definition and
 * src/admin/BlockRowLabel.tsx for the matching admin UI.
 */

const blockComponents: Record<string, React.ComponentType<any>> = {}

type Block = {
  blockType: string
  id?: string
  wrapper?: { hidden?: boolean } & Record<string, unknown>
  [key: string]: unknown
}

/**
 * A block is hidden if `wrapper.hidden === true` (standard path).
 * We also honour a top-level `hidden` key as a defensive fallback — useful
 * if someone adds per-block hide outside the wrapper schema.
 */
function isHidden(block: Block): boolean {
  if (block.wrapper?.hidden === true) return true
  if ((block as any).hidden === true) return true
  return false
}

export function RenderBlocks({ blocks }: { blocks: Block[] }) {
  if (!blocks || blocks.length === 0) return null

  return (
    <>
      {blocks.map((block, i) => {
        if (isHidden(block)) return null
        const Component = blockComponents[block.blockType]
        if (!Component) return null
        return <Component key={block.id || i} {...block} />
      })}
    </>
  )
}
