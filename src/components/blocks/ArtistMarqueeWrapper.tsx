import { getPayload } from 'payload'
import config from '@payload-config'
import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'
import { SectionHeader } from '@/components/SectionHeader'
import { ArtistMarqueeBlock } from './ArtistMarqueeBlock'

type Props = {
  sectionLabel?: string
  linkLabel?: string
  linkUrl?: string
  wrapper?: WrapperProps
}

export async function ArtistMarqueeWrapper({ sectionLabel, linkLabel, linkUrl, wrapper }: Props) {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'artists',
    limit: 50,
    sort: 'name',
  })

  const artists = result.docs.map((a: any) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    medium: a.medium || undefined,
    origin: a.origin || undefined,
    portrait: a.portrait && typeof a.portrait === 'object' ? { url: a.portrait.url, alt: a.portrait.alt } : null,
  }))

  return (
    <BlockWrapper
      {...wrapper}
      paddingBottom={wrapper?.paddingBottom || 'lg'}
      dividerTop={wrapper?.dividerTop ?? true}
      noEdge
      overflow
    >
      <div className="edge">
        <SectionHeader
          label={sectionLabel || 'Kuenstler:innen im Haus'}
          linkLabel={linkLabel || 'Alle'}
          linkUrl={linkUrl || '/kuenstlerinnen'}
        />
      </div>
      <ArtistMarqueeBlock artists={artists} />
    </BlockWrapper>
  )
}
