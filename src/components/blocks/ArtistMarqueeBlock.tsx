'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from '@/components/icons/ArrowRight'

type Artist = {
  id: string
  name: string
  slug: string
  medium?: string
  origin?: string
  portrait?: { url: string; alt?: string } | null
}

export function ArtistMarqueeBlock({ artists }: { artists: Artist[] }) {
  const marqueeRef = useRef<HTMLDivElement>(null)
  const portraitRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const set1Ref = useRef<HTMLSpanElement>(null)
  const [portraitSrc, setPortraitSrc] = useState<string | null>(null)
  const [animStyle, setAnimStyle] = useState<React.CSSProperties>({})

  // Measure Set 1 width and set animation accordingly
  useEffect(() => {
    const measure = () => {
      if (!set1Ref.current) return
      const set1Width = set1Ref.current.offsetWidth
      // Speed: ~100px per second
      const duration = set1Width / 100
      setAnimStyle({
        animation: `marquee ${duration}s linear infinite`,
      })
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [artists])

  // Portrait cursor tracking
  useEffect(() => {
    const marquee = marqueeRef.current
    const portrait = portraitRef.current
    if (!marquee || !portrait) return

    let currentSrc = ''

    const onMouseMove = (e: MouseEvent) => {
      portrait.style.left = (e.clientX + 24) + 'px'
      portrait.style.top = (e.clientY - 160) + 'px'

      portrait.style.pointerEvents = 'none'
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const nameEl = el?.closest('.artist-name') as HTMLElement | null

      if (nameEl?.dataset.portrait && nameEl.dataset.portrait !== '') {
        if (nameEl.dataset.portrait !== currentSrc) {
          currentSrc = nameEl.dataset.portrait
          setPortraitSrc(currentSrc)
        }
        portrait.style.display = 'block'
        portrait.style.opacity = '1'
      } else {
        portrait.style.opacity = '0'
        currentSrc = ''
      }
    }

    const onMouseLeave = () => {
      portrait.style.opacity = '0'
      currentSrc = ''
      setTimeout(() => { portrait.style.display = 'none' }, 200)
    }

    marquee.addEventListener('mousemove', onMouseMove)
    marquee.addEventListener('mouseleave', onMouseLeave)

    return () => {
      marquee.removeEventListener('mousemove', onMouseMove)
      marquee.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  if (!artists.length) return null

  const nameElements = (isLink: boolean, prefix: string) =>
    artists.map((a) => (
      <span key={`${prefix}-${a.id}`}>
        {isLink ? (
          <Link href={`/kuenstlerinnen/${a.slug}`} className="artist-name inline-flex items-center text-[10vw] lg:text-[8rem] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase hover:underline hover:underline-offset-[8px] hover:decoration-2 transition-all mx-[0.3em] py-2" data-portrait={a.portrait?.url || undefined}>
            {a.name}
          </Link>
        ) : (
          <span className="artist-name inline-flex items-center text-[10vw] lg:text-[8rem] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase mx-[0.3em] py-2" data-portrait={a.portrait?.url || undefined}>
            {a.name}
          </span>
        )}
        <span className="inline-block text-[10vw] lg:text-[8rem] font-extralight leading-[0.88] tracking-[-0.04em] text-warm-gray mx-[0.15em]">/</span>
      </span>
    ))

  return (
    <>
      {/* Desktop Marquee */}
      <div className="relative hidden md:block" ref={marqueeRef}>
        <div ref={portraitRef} className="pointer-events-none fixed z-50 w-[240px] h-[320px] overflow-hidden opacity-0 transition-opacity duration-200" style={{ display: 'none' }}>
          {portraitSrc && <img src={portraitSrc} alt="" className="img-cover" />}
        </div>

        <div ref={trackRef} className="marquee-track flex whitespace-nowrap py-4" style={animStyle}>
          {/* Set 1 — measured for animation */}
          <span ref={set1Ref} className="flex">
            {nameElements(true, 'a')}
          </span>
          {/* Set 2 — seamless duplicate */}
          <span className="flex">
            {nameElements(false, 'b')}
          </span>
        </div>
      </div>

      {/* Mobile: Stacked list */}
      <div className="md:hidden edge">
        <div className="flex flex-col">
          {artists.map((a) => (
            <Link key={a.id} href={`/kuenstlerinnen/${a.slug}`} className="group block border-t border-deep-black py-5">
              <div className="flex items-center gap-4">
                {a.portrait?.url && (
                  <div className="w-16 h-16 rounded-full overflow-hidden shrink-0">
                    <img src={a.portrait.url} alt={a.portrait.alt || a.name} className="img-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[7vw] font-extrabold leading-[0.9] tracking-[-0.03em] uppercase group-hover:underline group-hover:underline-offset-4">{a.name}</h3>
                  {(a.medium || a.origin) && (
                    <p className="text-[11px] text-warm-gray mt-1 tracking-[0.04em]">
                      {[a.medium, a.origin].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <ArrowRight className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              </div>
            </Link>
          ))}
          <div className="border-t border-deep-black" />
        </div>
      </div>
    </>
  )
}
