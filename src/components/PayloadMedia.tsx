import { PayloadImage } from './PayloadImage'
import { PayloadVideo } from './PayloadVideo'

type MediaInput = {
  url?: string | null
  alt?: string | null
  mimeType?: string | null
  videoVariants?: {
    webmUrl?: string | null
    mp4Url?: string | null
    posterUrl?: string | null
  }
} | null | undefined

type Props = {
  media: MediaInput
  /** Image-only: responsive size hint passed to the browser's srcset picker. Ignored for video. */
  sizes?: string
  /** Image-only: LCP boost (eager + fetchpriority=high). Ignored for video. */
  priority?: boolean
  /** Image-only: eager-load without the priority bump. Ignored for video. */
  eager?: boolean
  /** Video-only: gate playback to viewport intersection. Default true. Ignored for image. */
  lazyPlay?: boolean
  /** Forwarded to the <video> tag (no effect for image — use parent container instead). */
  videoClassName?: string
}

/**
 * Single media slot — picks <PayloadImage> or <PayloadVideo> by mimeType.
 * Lets block schemas use one `media` field instead of separate image/video,
 * so editors don't pre-decide which medium fits a slot.
 *
 * Place inside a relatively positioned container with a defined aspect ratio:
 *   <div className="relative aspect-[16/9] overflow-hidden">
 *     <PayloadMedia media={data.media} sizes="100vw" />
 *   </div>
 */
export function PayloadMedia({
  media,
  sizes,
  priority,
  eager,
  lazyPlay,
  videoClassName = 'absolute inset-0 w-full h-full object-cover',
}: Props) {
  if (!media || typeof media !== 'object' || !media.url) return null

  if (media.mimeType?.startsWith('video/')) {
    return <PayloadVideo video={media as any} className={videoClassName} lazyPlay={lazyPlay} />
  }

  return <PayloadImage image={media} sizes={sizes} priority={priority} eager={eager} />
}

/** True when the media object is a video (or false when no media). Useful for
 *  branching overlays/UI that depend on media type without re-checking
 *  mimeType (e.g. "show play button only on still images"). */
export function isVideoMedia(media: MediaInput): boolean {
  return Boolean(media?.mimeType?.startsWith('video/'))
}
