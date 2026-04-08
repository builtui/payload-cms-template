import Link from 'next/link'
import { ArrowRight } from '@/components/icons/ArrowRight'

type Props = {
  backLink?: { label?: string; url?: string }
  typeLabel?: string
  title: string
  subtitle?: string
  metaItems?: { text: string; muted?: boolean }[]
  metaStyle?: 'inline' | 'spread'
  wrapper?: any
}

export function DetailHeaderBlock({ backLink, typeLabel, title, subtitle, metaItems, metaStyle = 'spread' }: Props) {
  return (
    <>
      {/* Back link — header offset */}
      <section className="pt-14 md:pt-16">
        <div className="edge pt-6 pb-2">
          {backLink?.url && (
            <Link href={backLink.url} className="link text-[12px] text-anthracite tracking-[0.04em]">
              <ArrowRight className="w-3.5 h-3.5 shrink-0 rotate-180" /> {backLink.label || 'Zurueck'}
            </Link>
          )}
        </div>
      </section>

      {/* Title + Meta + Divider */}
      <section className="pb-8 md:pb-12">
        <div className="edge">
          {typeLabel && (
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">{typeLabel}</span>
          )}
          <h1 className={`${typeLabel ? 'mt-3' : ''} text-[clamp(2.5rem,8vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase`}>
            {title}
          </h1>
          {subtitle && (
            <h2 className="text-[clamp(1.5rem,4vw,3.5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-anthracite mt-1">
              {subtitle}
            </h2>
          )}

          {metaItems && metaItems.length > 0 && metaStyle === 'spread' && (
            <div className="mt-6 md:mt-8 border-t border-deep-black pt-4 flex flex-wrap gap-x-10 gap-y-2 text-[13px]">
              {metaItems.map((item, i) => (
                <span key={i} className={item.muted ? 'text-warm-gray' : ''}>{item.text}</span>
              ))}
            </div>
          )}

          {metaItems && metaItems.length > 0 && metaStyle === 'inline' && (
            <>
              <p className="text-sm md:text-base text-anthracite mt-4">
                {metaItems.map((item, i) => (
                  <span key={i} className={item.muted ? 'text-warm-gray' : ''}>
                    {i > 0 && ' · '}{item.text}
                  </span>
                ))}
              </p>
              <div className="border-t border-deep-black mt-6 md:mt-8" />
            </>
          )}

          {(!metaItems || metaItems.length === 0) && (
            <div className="border-t border-deep-black mt-6 md:mt-8" />
          )}
        </div>
      </section>
    </>
  )
}
