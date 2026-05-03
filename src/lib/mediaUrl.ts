/**
 * Prefixes a Payload media path with the CDN host if NEXT_PUBLIC_MEDIA_CDN_URL
 * is set. Returns the input unchanged for null/undefined/empty/absolute URLs.
 *
 * Set `NEXT_PUBLIC_MEDIA_CDN_URL=https://cdn.example.com` in `.env` for prod
 * deploys with a CDN. Leave empty for local dev or origin-only serving.
 *
 * Used by PayloadImage / PayloadVideo to bypass Next.js Image Optimization
 * when bytes can stream straight from edge instead of round-tripping through
 * the Next.js server's `/_next/image` route.
 */
export function resolveMediaUrl<T extends string | null | undefined>(path: T): T {
  if (!path) return path
  if (typeof path !== 'string') return path
  if (/^https?:\/\//i.test(path)) return path

  const cdn = process.env.NEXT_PUBLIC_MEDIA_CDN_URL?.replace(/\/$/, '') || ''
  if (!cdn) return path

  return `${cdn}${path}` as T
}
