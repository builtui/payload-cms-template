import { getPayload } from 'payload'
import config from '@payload-config'
import { BlockWrapper } from '@/components/BlockWrapper'
import { ProgrammClient } from './ProgrammClient'

const WEEKDAYS = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ']
const MONTHS_LONG = ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export default async function ProgrammPage() {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'events',
    sort: 'dateStart',
    limit: 100,
  })

  const events = result.docs.map((event: any) => {
    const d = new Date(event.dateStart)
    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      subtitle: event.subtitle || '',
      type: event.type,
      day: String(d.getDate()).padStart(2, '0'),
      weekday: WEEKDAYS[d.getDay()],
      monthShort: MONTHS_SHORT[d.getMonth()],
      monthLong: MONTHS_LONG[d.getMonth()],
      year: d.getFullYear(),
      yearShort: String(d.getFullYear()).slice(-2),
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      monthKey: `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`,
      previewUrl: typeof event.previewImage === 'object' ? event.previewImage?.url || null : null,
    }
  })

  const types = [...new Set(events.map((e) => e.type))]

  return (
    <>
      {/* Page Title — matches v6: pt-14 md:pt-16 (header offset) + pt-10 md:pt-16 (inner) */}
      <section className="pt-14 md:pt-16">
        <div className="edge pt-10 md:pt-16 pb-8 md:pb-10">
          <h1 className="text-[clamp(3rem,10vw,8rem)] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase">
            Programm
          </h1>
        </div>
      </section>

      {/* Filters + Event List */}
      <section className="pb-20 md:pb-32">
        <div className="edge">
          <ProgrammClient events={events} types={types} />
        </div>
      </section>
    </>
  )
}
