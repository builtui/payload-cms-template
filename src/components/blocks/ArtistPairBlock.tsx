import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'
import { CTALink } from '@/components/CTALink'

type Props = {
  artistLeft: string | { id: string }
  artistRight: string | { id: string }
  wrapper?: WrapperProps
}

async function resolveArtist(payload: any, ref: string | { id: string }) {
  const id = typeof ref === 'object' ? ref.id : ref
  return payload.findByID({ collection: 'artists', id })
}

export async function ArtistPairBlock({ artistLeft, artistRight, wrapper }: Props) {
  const payload = await getPayload({ config })

  const [left, right] = await Promise.all([
    resolveArtist(payload, artistLeft),
    resolveArtist(payload, artistRight),
  ])

  const artists = [left, right].filter(Boolean)

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'lg'}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-5">
        {artists.map((artist: any) => {
          const portraitUrl = typeof artist.portrait === 'object' ? artist.portrait?.url : null
          return (
            <Link key={artist.id} href={`/kuenstlerinnen/${artist.slug}`} className="group block">
              {portraitUrl && (
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={portraitUrl} alt={artist.name} className="img-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                </div>
              )}
              <div className="mt-4">
                {artist.medium && (
                  <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">{artist.medium}</p>
                )}
                <h3 className="text-xl md:text-2xl font-extrabold leading-[0.9] tracking-[-0.02em] uppercase mt-1">{artist.name}</h3>
                {artist.origin && <p className="text-sm text-anthracite mt-1">{artist.origin}</p>}
                <span className="link text-[12px] font-bold mt-3 tracking-[0.04em]">Profil ansehen</span>
              </div>
            </Link>
          )
        })}
      </div>
    </BlockWrapper>
  )
}
