'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from '@/components/icons/ArrowRight'

type EventItem = {
  id: string
  slug: string
  title: string
  subtitle: string
  type: string
  day: string
  weekday: string
  monthShort: string
  monthLong: string
  year: number
  yearShort: string
  time: string
  monthKey: string
  previewUrl: string | null
}

type Props = {
  events: EventItem[]
  types: string[]
}

export function ProgrammClient({ events, types }: Props) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const filtered = activeFilter
    ? events.filter((e) => e.type === activeFilter)
    : events

  // Group by month
  const grouped = filtered.reduce<Record<string, EventItem[]>>((acc, event) => {
    if (!acc[event.monthKey]) acc[event.monthKey] = []
    acc[event.monthKey].push(event)
    return acc
  }, {})

  return (
    <>
      {/* M13 Filter Tabs */}
      <div className="flex gap-5 md:gap-7 overflow-x-auto mb-10 md:mb-12">
        <button
          className={`filter-tab ${!activeFilter ? 'active' : ''}`}
          onClick={() => setActiveFilter(null)}
        >
          Alle
        </button>
        {types.map((type) => (
          <button
            key={type}
            className={`filter-tab ${activeFilter === type ? 'active' : ''}`}
            onClick={() => setActiveFilter(type)}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Event list grouped by month */}
      <div className="flex flex-col">
        {Object.entries(grouped).map(([monthKey, monthEvents]) => {
          const first = monthEvents[0]
          return (
            <div key={monthKey}>
              {/* M14 Month Divider */}
              <div className="sticky top-14 md:top-16 z-20 bg-warm-white/95 backdrop-blur-sm py-3 -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12">
                <p className="text-[13px] font-bold tracking-[0.12em] uppercase text-warm-gray">
                  {first.monthLong} {first.year}
                </p>
              </div>

              {monthEvents.map((event) => (
                <Link key={event.id} href={`/programm/${event.slug}`} className="event-row group block border-t border-deep-black relative">
                  <div className="py-8 md:py-10 grid grid-cols-[1fr] md:grid-cols-[140px_1fr_auto] gap-3 md:gap-0 md:items-center">
                    <div>
                      <div className="flex items-end gap-3">
                        <span className="text-[4rem] md:text-[5.5rem] font-extrabold leading-[0.75] tracking-[-0.04em]">{event.day}</span>
                        <div className="text-[11px] text-warm-gray leading-tight tracking-[0.06em] uppercase">
                          <span className="block font-bold text-deep-black">{event.weekday}</span>
                          <span className="block">{event.monthShort} {event.yearShort}</span>
                        </div>
                      </div>
                      <span className="block text-[2rem] font-bold leading-none tracking-[-0.02em] mt-1">{event.time}</span>
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
                    {event.previewUrl && (
                      <div className="hover-img absolute right-12 top-1/2 -translate-y-1/2 w-[200px] h-[260px] hidden lg:block z-10 overflow-hidden">
                        <img src={event.previewUrl} alt="" className="img-cover" />
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )
        })}
        <div className="border-t border-deep-black" />
      </div>
    </>
  )
}
