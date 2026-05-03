'use client'

import { useEffect, useRef } from 'react'
import { resolveMediaUrl } from '@/lib/mediaUrl'

type VideoMedia = {
  url?: string | null
  mimeType?: string | null
  videoVariants?: {
    webmUrl?: string | null
    mp4Url?: string | null
    posterUrl?: string | null
  }
} | null | undefined

type Props = {
  video: VideoMedia
  className?: string
  /** Lazy-play via IntersectionObserver: only plays when ≥50% visible. Default true. */
  lazyPlay?: boolean
}

// Payload's media route, NOT a static dir. The `/media/` path doesn't resolve
// in Next.js — only `/api/media/file/<filename>` is handled by Payload and
// serves any file in `staticDir` (including the transcoded webm/mp4/poster).
const MEDIA_ROOT = '/api/media/file'

/**
 * URL helper. Two input shapes accepted:
 * - relative filename (e.g. `foo.webm`) — the form `videoVariants` stores —
 *   gets prefixed with `/api/media/file/` + CDN host
 * - absolute path (e.g. `/api/media/file/foo.mp4`) — the form `media.url`
 *   already has — just CDN-prefixed
 */
function urlFor(input?: string | null): string {
  if (!input) return ''
  const path = input.startsWith('/') ? input : `${MEDIA_ROOT}/${input}`
  return resolveMediaUrl(path) || ''
}

/**
 * Renders a Payload Media doc that's a video. Expects a `videoVariants`
 * group on the media doc populated by an afterChange hook running
 * `scripts/transcode-video.sh` (produces .webm + .mp4 + .webp poster).
 *
 * Falls back to playing the originally uploaded file if variants haven't
 * been generated yet (e.g. ffmpeg not installed, hook hasn't fired) so the
 * page never breaks on a fresh upload.
 *
 * Lazy-plays by default — pauses when scrolled out of view to save CPU /
 * battery on long pages with multiple background videos.
 */
export function PayloadVideo({ video, className, lazyPlay = true }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !lazyPlay) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {})
        else el.pause()
      },
      { threshold: 0.5 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [lazyPlay])

  if (!video) return null

  const { videoVariants, url: originalUrl, mimeType } = video
  const webmUrl = videoVariants?.webmUrl
  const mp4Url = videoVariants?.mp4Url
  const posterUrl = videoVariants?.posterUrl
  const hasVariants = Boolean(webmUrl || mp4Url)

  const fallbackSrc = !hasVariants && originalUrl ? urlFor(originalUrl) : ''
  const fallbackType = mimeType?.startsWith('video/') ? mimeType : 'video/mp4'

  if (!hasVariants && !fallbackSrc) return null

  return (
    <video
      ref={ref}
      className={className}
      autoPlay={!lazyPlay}
      muted
      loop
      playsInline
      preload="metadata"
      poster={posterUrl ? urlFor(posterUrl) : undefined}
    >
      {hasVariants ? (
        <>
          {webmUrl && <source src={urlFor(webmUrl)} type="video/webm" />}
          {mp4Url && <source src={urlFor(mp4Url)} type="video/mp4" />}
        </>
      ) : (
        <source src={fallbackSrc} type={fallbackType} />
      )}
    </video>
  )
}
