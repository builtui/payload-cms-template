import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'
import { SectionHeader } from '@/components/SectionHeader'
import { ArrowRight } from '@/components/icons/ArrowRight'

type Props = {
  sectionLabel?: string
  linkLabel?: string
  linkUrl?: string
  limit?: number
  wrapper?: WrapperProps
}

const WEEKDAYS = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ']

export async function EventListBlock({ sectionLabel, linkLabel, linkUrl, limit = 4, wrapper }: Props) {
  const payload = await getPayload({ config })

  const events = await payload.find({
    collection: 'events',
    where: { status: { not_equals: 'past' } },
    sort: 'dateStart',
    limit,
  })

  return (
    <BlockWrapper {...wrapper} paddingTop={wrapper?.paddingTop || 'sm'} paddingBottom={wrapper?.paddingBottom || 'xl'}>
      <SectionHeader
        label={sectionLabel || 'Programm'}
        linkLabel={linkLabel || 'Alle Veranstaltungen'}
        linkUrl={linkUrl || '/programm'}
      />
      <div className="flex flex-col">
        {events.docs.map((event: any) => {
          const d = new Date(event.dateStart)
          const day = String(d.getDate()).padStart(2, '0')
          const weekday = WEEKDAYS[d.getDay()]
          const month = MONTHS[d.getMonth()]
          const year = String(d.getFullYear()).slice(-2)
          const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          const previewUrl = typeof event.previewImage === 'object' ? event.previewImage?.url : null

          return (
            <Link key={event.id} href={`/programm/${event.slug}`} className="event-row group block border-t border-deep-black relative">
              <div className="py-8 md:py-10 grid grid-cols-[1fr] md:grid-cols-[140px_1fr_auto] gap-3 md:gap-0 md:items-center">
                <div>
                  <div className="flex items-end gap-3">
                    <span className="text-[4rem] md:text-[5.5rem] font-extrabold leading-[0.75] tracking-[-0.04em]">{day}</span>
                    <div className="text-[11px] text-warm-gray leading-tight tracking-[0.06em] uppercase">
                      <span className="block font-bold text-deep-black">{weekday}</span>
                      <span className="block">{month} {year}</span>
                    </div>
                  </div>
                  <span className="block text-[2rem] font-bold leading-none tracking-[-0.02em] mt-1">{time}</span>
                </div>
                <div className="md:pl-8 lg:pl-16 flex flex-col justify-center">
                  <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">{event.type}</span>
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-[-0.02em] mt-1 group-hover:underline group-hover:underline-offset-[6px] group-hover:decoration-1">
                    {event.title}
                  </h3>
                  {event.subtitle && <p className="text-sm text-anthracite mt-1">{event.subtitle}</p>}
                </div>
                <div className="flex items-end shrink-0 pb-2">
                  <ArrowRight className="w-10 h-10 md:w-14 md:h-14" strokeWidth={1.5} />
                </div>
                {previewUrl && (
                  <div className="hover-img absolute right-12 top-1/2 -translate-y-1/2 w-[200px] h-[260px] hidden lg:block z-10 overflow-hidden">
                    <img src={previewUrl} alt="" className="img-cover" />
                  </div>
                )}
              </div>
            </Link>
          )
        })}
        <div className="border-t border-deep-black" />
      </div>
    </BlockWrapper>
  )
}
