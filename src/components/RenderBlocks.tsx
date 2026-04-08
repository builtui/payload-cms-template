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
 */

const blockComponents: Record<string, React.ComponentType<any>> = {}

type Block = {
  blockType: string
  id?: string
  [key: string]: unknown
}

export function RenderBlocks({ blocks }: { blocks: Block[] }) {
  if (!blocks || blocks.length === 0) return null

  return (
    <>
      {blocks.map((block, i) => {
        const Component = blockComponents[block.blockType]
        if (!Component) return null
        return <Component key={block.id || i} {...block} />
      })}
    </>
  )
}
