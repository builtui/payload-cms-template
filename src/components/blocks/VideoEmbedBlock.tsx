'use client'

import { useState, useEffect, useCallback } from 'react'
import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'

type Props = {
  sectionLabel?: string
  url: string
  posterImage?: any
  caption?: string
  wrapper?: WrapperProps
}

function getEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?dnt=1`

  return null
}

function getServiceName(url: string): string {
  if (url.includes('youtube') || url.includes('youtu.be')) return 'YouTube'
  if (url.includes('vimeo')) return 'Vimeo'
  return 'dem Videoanbieter'
}

export function VideoEmbedBlock({ sectionLabel, url, posterImage, caption, wrapper }: Props) {
  const [hasConsent, setHasConsent] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hh-cookie-consent')
      if (stored) {
        const consent = JSON.parse(stored)
        if (consent.externalMedia) {
          setHasConsent(true)
        }
      }
    } catch {}

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.externalMedia) {
        setHasConsent(true)
        setShowVideo(true)
      }
    }
    window.addEventListener('cookie-consent-update', handler)
    return () => window.removeEventListener('cookie-consent-update', handler)
  }, [])

  const loadVideo = useCallback(() => {
    setShowVideo(true)
  }, [])

  const openCookieSettings = useCallback(() => {
    // Remove stored consent to re-trigger banner
    localStorage.removeItem('hh-cookie-consent')
    document.cookie = 'hh-cookie-consent=; path=/; max-age=0'
    window.location.reload()
  }, [])

  const embedUrl = getEmbedUrl(url)
  if (!embedUrl) return null

  const posterUrl = typeof posterImage === 'object' ? posterImage?.url : null
  const serviceName = getServiceName(url)

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'md'}>
      {sectionLabel && (
        <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase mb-6 md:mb-8">{sectionLabel}</h2>
      )}

      <div className="relative aspect-[16/9] overflow-hidden">
        {showVideo ? (
          /* Video iframe */
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : hasConsent ? (
          /* Has consent but not yet clicked play */
          <button onClick={loadVideo} className="absolute inset-0 w-full h-full flex flex-col items-center justify-center cursor-pointer group bg-deep-black/5">
            {posterUrl && (
              <img src={posterUrl} alt="" className="absolute inset-0 img-cover opacity-70 group-hover:opacity-80 transition-opacity" />
            )}
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-full bg-deep-black/80 flex items-center justify-center mx-auto group-hover:bg-deep-black transition-colors">
                <svg className="w-6 h-6 text-warm-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </button>
        ) : (
          /* No consent — info placeholder */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-deep-black/5 text-center px-6">
            {posterUrl && (
              <img src={posterUrl} alt="" className="absolute inset-0 img-cover opacity-20" />
            )}
            <div className="relative z-10 max-w-[400px]">
              <div className="w-12 h-12 rounded-full bg-warm-gray/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-anthracite" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-bold text-deep-black mb-2">
                Hier ist ein Video von {serviceName} eingebettet
              </p>
              <p className="text-xs text-anthracite leading-relaxed mb-4">
                Zum Laden des Videos werden Daten an {serviceName} uebertragen.
                Weitere Informationen finden Sie in unserer Datenschutzerklaerung.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={loadVideo}
                  className="text-xs font-bold px-5 py-2 bg-deep-black text-warm-white hover:bg-anthracite transition-colors"
                >
                  Video einmalig laden
                </button>
                <button
                  onClick={openCookieSettings}
                  className="text-xs px-5 py-2 border border-deep-black text-deep-black hover:bg-deep-black hover:text-warm-white transition-colors"
                >
                  Cookie-Einstellungen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {caption && (
        <p className="text-[11px] text-warm-gray mt-2">{caption}</p>
      )}
    </BlockWrapper>
  )
}
