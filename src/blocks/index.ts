import { Hero } from './Hero'
import { PageTitle } from './PageTitle'
import { TextImageSplit } from './TextImageSplit'
import { FeaturedExhibition } from './FeaturedExhibition'
import { ProseSection } from './ProseSection'
import { BodySidebar } from './BodySidebar'
import { DataList } from './DataList'
import { EventList } from './EventList'
import { GalleryGrid } from './GalleryGrid'
import { FullWidthImage } from './FullWidthImage'
import { Blockquote } from './Blockquote'
import { ImagePair } from './ImagePair'
import { ProjectCards } from './ProjectCards'
import { ArtistMarquee } from './ArtistMarquee'
import { Newsletter } from './Newsletter'
import { DetailHeader } from './DetailHeader'
import { KeyInfoBlock } from './KeyInfoBlock'
import { InfoGrid } from './InfoGrid'
import { VideoEmbed } from './VideoEmbed'
import { ArtistFeature } from './ArtistFeature'
import { ArtistPair } from './ArtistPair'

export {
  Hero, PageTitle, TextImageSplit, FeaturedExhibition, ProseSection, BodySidebar,
  DataList, EventList, GalleryGrid, FullWidthImage, Blockquote, ImagePair,
  ProjectCards, ArtistMarquee, Newsletter, DetailHeader, KeyInfoBlock,
  ArtistFeature, ArtistPair, InfoGrid, VideoEmbed,
}

// All blocks — for Pages collection (full flexibility)
export const allBlocks = [
  Hero, PageTitle, TextImageSplit, FeaturedExhibition, ProseSection, BodySidebar,
  DataList, EventList, GalleryGrid, FullWidthImage, Blockquote, ImagePair,
  ProjectCards, ArtistMarquee, Newsletter, DetailHeader, KeyInfoBlock, InfoGrid,
  VideoEmbed, ArtistFeature, ArtistPair,
]

// Detail page blocks — for Event/Project detail pages
export const detailBlocks = [
  DetailHeader, FullWidthImage, BodySidebar, ProseSection, DataList,
  GalleryGrid, Blockquote, ImagePair, TextImageSplit, VideoEmbed, Newsletter, EventList,
]

// Artist detail blocks
export const artistBlocks = [
  ...detailBlocks, ArtistFeature, ArtistPair, PageTitle,
]
