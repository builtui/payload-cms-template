import { resolveMediaUrl } from '@/lib/mediaUrl'

type Props = {
  image: any
  /** Responsive size hint for the browser to pick a srcset candidate. */
  sizes?: string
  /** LCP image: eager load + fetchpriority=high. */
  priority?: boolean
  /** Eager load without the priority bump — for above-the-fold tiles that aren't the LCP. */
  eager?: boolean
}

/**
 * Renders a Payload media image as a CDN-served <img>. Skips Next.js Image
 * Optimization so the bytes stream straight from the CDN edge instead of
 * round-tripping through the Next.js server's `/_next/image` route.
 *
 * srcset uses Sharp's aspect-preserving variants (`small-w`, `medium-w`,
 * `hero`) plus the original. Cropped variants (thumbnail/card with both
 * width AND height set) are deliberately excluded — they would show a
 * different region than the original inside arbitrary aspect-ratio
 * containers.
 *
 * Trade-off vs. Next.js Image:
 *   ✓ Edge delivery (real CDN, not just origin pull)
 *   ✓ Lower bandwidth on the app server
 *   ✗ Coarser srcset granularity (limited to pre-generated Sharp sizes)
 *
 * Place inside a relatively positioned container with an explicit aspect
 * ratio:
 *   <div className="relative aspect-[16/9] overflow-hidden">
 *     <PayloadImage image={data.image} sizes="100vw" />
 *   </div>
 */
export function PayloadImage({ image, sizes = '100vw', priority = false, eager = false }: Props) {
  if (!image || typeof image !== 'object' || !image.url) return null

  const candidates = new Map<number, string>()
  // Pull every aspect-preserving variant from Sharp's pre-generated sizes.
  // Cropped variants are skipped because they'd show a different region than
  // the original inside arbitrary aspect-ratio containers.
  for (const key of ['small-w', 'medium-w', 'hero'] as const) {
    const v = image.sizes?.[key]
    if (v?.url && v.width) candidates.set(v.width, v.url)
  }
  if (image.width && image.url) {
    candidates.set(image.width, image.url)
  }

  const sorted = [...candidates.entries()].sort((a, b) => a[0] - b[0])
  const srcSet = sorted.length > 0
    ? sorted.map(([w, u]) => `${resolveMediaUrl(u)} ${w}w`).join(', ')
    : undefined

  // Largest candidate as fallback `src`; falls back to the original URL when
  // no size info is present (defensive for legacy / oddly-shaped media records).
  const src = resolveMediaUrl(sorted.at(-1)?.[1] ?? image.url)

  const isEager = priority || eager

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={image.alt || ''}
      className="absolute inset-0 w-full h-full object-cover"
      loading={isEager ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      width={image.width || undefined}
      height={image.height || undefined}
    />
  )
}
