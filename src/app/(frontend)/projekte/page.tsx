import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { ArrowRight } from '@/components/icons/ArrowRight'

export default async function ProjectListPage() {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'projects',
    limit: 50,
  })

  return (
    <>
      {/* Page Title */}
      <section className="pt-14 md:pt-16">
        <div className="edge pt-10 md:pt-16 pb-6">
          <h1 className="text-[clamp(2.5rem,8vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase">Projekte</h1>
        </div>
      </section>

      {/* Intro */}
      <section className="pb-12 md:pb-20">
        <div className="edge">
          <div className="md:grid md:grid-cols-12 gap-6">
            <div className="md:col-span-2">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">Projekte</span>
            </div>
            <div className="md:col-span-7 mt-3 md:mt-0">
              <p className="text-lg md:text-xl leading-[1.6] text-anthracite">
                Das Hugenottenhaus traegt mehrere langfristige Projekte, die Kunst, Gemeinschaft und internationalen Austausch verbinden. Jedes Projekt oeffnet das Haus auf eine andere Weise — als Atelier, als Buehne, als Begegnungsort.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Projects — alternating TextImageSplit layout */}
      {result.docs.map((project: any, i: number) => {
        const imgUrl = typeof project.image === 'object' ? project.image?.url : null
        const imgAlt = typeof project.image === 'object' ? project.image?.alt || '' : ''
        const isReversed = i % 2 === 1 // every second project has image left

        const textCol = (
          <div className={`md:col-span-4 flex flex-col justify-between ${isReversed ? 'order-1 md:order-2' : ''}`}>
            <div>
              <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase mb-6 md:mb-8">
                {project.title?.split(' ').slice(0, 2).join(' ')}
              </h2>
              <h3 className="text-2xl font-bold leading-[1.05] tracking-[-0.02em]">{project.title}</h3>
              {project.description && (
                <p className="text-sm text-anthracite mt-4 leading-relaxed">{project.description}</p>
              )}
            </div>
            <Link href={`/projekte/${project.slug}`} className="link text-sm font-bold mt-8 tracking-[0.04em]">
              Mehr erfahren <ArrowRight />
            </Link>
          </div>
        )

        const imageCol = (
          <div className={`md:col-span-8 mt-8 md:mt-0 ${isReversed ? 'order-2 md:order-1' : ''}`}>
            {imgUrl && (
              <div className="aspect-[4/3] md:aspect-[16/10] overflow-hidden">
                <img src={imgUrl} alt={imgAlt} className="img-cover" />
              </div>
            )}
          </div>
        )

        return (
          <section key={project.id} className="pb-16 md:pb-28">
            <div className="edge">
              <div className="border-t border-deep-black pt-12 md:pt-20" />
              <div className="md:grid md:grid-cols-12 gap-6 md:gap-8">
                {isReversed ? (
                  <>{imageCol}{textCol}</>
                ) : (
                  <>{textCol}{imageCol}</>
                )}
              </div>
            </div>
          </section>
        )
      })}
    </>
  )
}
