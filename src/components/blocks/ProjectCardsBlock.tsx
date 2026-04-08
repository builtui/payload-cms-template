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

export async function ProjectCardsBlock({ sectionLabel, linkLabel, linkUrl, limit = 3, wrapper }: Props) {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'projects',
    limit,
  })

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'lg'} dividerTop={wrapper?.dividerTop ?? true}>
      <SectionHeader
        label={sectionLabel || 'Projekte'}
        linkLabel={linkLabel || 'Alle Projekte'}
        linkUrl={linkUrl || '/projekte'}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5">
        {result.docs.map((project: any) => {
          const imgUrl = typeof project.image === 'object' ? project.image?.url : null

          return (
            <Link key={project.id} href={`/projekte/${project.slug}`} className="group block">
              {imgUrl && (
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={imgUrl} alt={project.image?.alt || ''} className="img-cover" />
                </div>
              )}
              <div className="mt-4">
                <h3 className="font-bold text-lg tracking-[-0.01em]">{project.title}</h3>
                {project.description && (
                  <p className="text-sm text-anthracite mt-1 leading-relaxed">{project.description}</p>
                )}
                <span className="link text-[12px] font-bold mt-3 tracking-[0.04em]">
                  Mehr erfahren <ArrowRight />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </BlockWrapper>
  )
}
