import React from 'react'
import { HeroBlock } from '@/components/blocks/HeroBlock'
import { PageTitleBlock } from '@/components/blocks/PageTitleBlock'
import { TextImageSplitBlock } from '@/components/blocks/TextImageSplitBlock'
import { FeaturedExhibitionBlock } from '@/components/blocks/FeaturedExhibitionBlock'
import { ProseSectionBlock } from '@/components/blocks/ProseSectionBlock'
import { BodySidebarBlock } from '@/components/blocks/BodySidebarBlock'
import { FullWidthImageBlock } from '@/components/blocks/FullWidthImageBlock'
import { BlockquoteBlock } from '@/components/blocks/BlockquoteBlock'
import { ImagePairBlock } from '@/components/blocks/ImagePairBlock'
import { GalleryGridBlock } from '@/components/blocks/GalleryGridBlock'
import { EventListBlock } from '@/components/blocks/EventListBlock'
import { ProjectCardsBlock } from '@/components/blocks/ProjectCardsBlock'
import { ArtistMarqueeWrapper } from '@/components/blocks/ArtistMarqueeWrapper'
import { NewsletterBlock } from '@/components/blocks/NewsletterBlock'
import { DetailHeaderBlock } from '@/components/blocks/DetailHeaderBlock'
import { KeyInfoBlockBlock } from '@/components/blocks/KeyInfoBlockBlock'
import { ArtistFeatureBlock } from '@/components/blocks/ArtistFeatureBlock'
import { ArtistPairBlock } from '@/components/blocks/ArtistPairBlock'
import { DataListBlock } from '@/components/blocks/DataListBlock'
import { InfoGridBlock } from '@/components/blocks/InfoGridBlock'
import { VideoEmbedBlock } from '@/components/blocks/VideoEmbedBlock'

const blockComponents: Record<string, React.ComponentType<any>> = {
  'm2-hero': HeroBlock,
  'm1-page-title': PageTitleBlock,
  'm3-text-image-split': TextImageSplitBlock,
  'm5-featured-exhibition': FeaturedExhibitionBlock,
  'm3c-prose-section': ProseSectionBlock,
  'm3d-body-sidebar': BodySidebarBlock,
  'm7-full-width-image': FullWidthImageBlock,
  'm8-blockquote': BlockquoteBlock,
  'm9-image-pair': ImagePairBlock,
  'm6-gallery-grid': GalleryGridBlock,
  'm4-event-list': EventListBlock,
  'm10-project-cards': ProjectCardsBlock,
  'm11-artist-marquee': ArtistMarqueeWrapper,
  'm12-newsletter': NewsletterBlock,
  'm15-detail-header': DetailHeaderBlock,
  'm16-key-info': KeyInfoBlockBlock,
  'm17a-artist-feature': ArtistFeatureBlock,
  'm17b-artist-pair': ArtistPairBlock,
  'm3e-data-list': DataListBlock,
  'm16b-info-grid': InfoGridBlock,
  'm3f-video-embed': VideoEmbedBlock,
}

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
