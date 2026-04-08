import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'
import { CTALink } from '@/components/CTALink'

type Props = {
  artist: string | { id: string }
  imagePosition?: 'left' | 'right'
  wrapper?: WrapperProps
}

export async function ArtistFeatureBlock({ artist: artistRef, imagePosition = 'left', wrapper }: Props) {
  const payload = await getPayload({ config })
  const artistId = typeof artistRef === 'object' ? artistRef.id : artistRef

  const artist = await payload.findByID({ collection: 'artists', id: artistId })
  if (!artist) return null

  const portraitUrl = typeof artist.portrait === 'object' ? (artist.portrait as any)?.url : null
  const isLeft = imagePosition === 'left'

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'lg'}>
      <div className="md:grid md:grid-cols-12 gap-5 md:gap-6">
        {/* Image */}
        <div className={`md:col-span-7 ${isLeft ? 'md:order-1' : 'md:order-2 md:col-start-6'}`}>
          <div className="aspect-[4/3] overflow-hidden">
            {portraitUrl && <img src={portraitUrl} alt={artist.name} className="img-cover" />}
          </div>
        </div>
        {/* Text */}
        <div className={`md:col-span-5 flex flex-col justify-center mt-6 md:mt-0 ${isLeft ? 'md:order-2' : 'md:order-1'}`}>
          {artist.medium && (
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">{artist.medium}</p>
          )}
          <h3 className="text-3xl md:text-4xl font-extrabold leading-[0.9] tracking-[-0.03em] uppercase mt-2">
            {artist.name}
          </h3>
          {artist.origin && (
            <p className="text-base text-anthracite mt-2">{artist.origin}</p>
          )}
          <CTALink label="Profil ansehen" url={`/kuenstlerinnen/${artist.slug}`} className="mt-6" />
        </div>
      </div>
    </BlockWrapper>
  )
}
