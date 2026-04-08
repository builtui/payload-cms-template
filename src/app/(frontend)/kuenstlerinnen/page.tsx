import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { ArrowRight } from '@/components/icons/ArrowRight'

export default async function ArtistListPage() {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'artists',
    limit: 50,
    sort: 'name',
  })

  return (
    <>
      {/* Page Title — matches v6 spacing */}
      <section className="pt-14 md:pt-16">
        <div className="edge pt-10 md:pt-16 pb-8 md:pb-10">
          <h1 className="text-[clamp(3rem,10vw,8rem)] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase">
            Kuenstler:innen
          </h1>
        </div>
      </section>

      {/* Artist Grid */}
      <section className="pb-16 md:pb-28">
        <div className="edge">
          <div className="border-t border-deep-black pt-12 md:pt-16" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-5">
            {result.docs.map((artist: any) => {
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
                    <span className="link text-[12px] font-bold mt-3 tracking-[0.04em]">
                      Profil ansehen <ArrowRight />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
