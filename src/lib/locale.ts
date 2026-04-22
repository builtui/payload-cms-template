import { headers } from 'next/headers'
import type { Locale } from './detectLocale'
export type { Locale }

export const SUPPORTED_LOCALES: Locale[] = ['en', 'de']
export const DEFAULT_LOCALE: Locale = 'en'

/**
 * Resolves the current locale from the URL pathname that the middleware
 * forwards as `x-pathname`. Used for cases where params aren't easily
 * accessible (e.g. inside a deeply nested server component called by
 * a layout).
 *
 * IMPORTANT — this uses `headers()` which makes the consumer DYNAMIC.
 * For pages that you want statically generated (ISR/SSG), read locale
 * from `params` in the page/layout file directly and pass it down as
 * a prop, rather than calling currentLocale() in leaf components.
 */
export async function currentLocale(): Promise<Locale> {
  const h = await headers()
  const pathname = h.get('x-pathname') || ''
  for (const loc of SUPPORTED_LOCALES) {
    if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) return loc
  }
  return DEFAULT_LOCALE
}

/**
 * Pure helper — build an internal href with the correct locale prefix.
 * `/about` → `/en/about`  |  `/` → `/en`.
 *
 * Safe to use in Server Components, Client Components, and server-side
 * seed scripts. Pass the locale explicitly; don't call currentLocale()
 * inside this.
 */
export function buildLocalePath(locale: string, path: string = '/'): string {
  const cleaned = path.startsWith('/') ? path : `/${path}`
  if (cleaned === '/') return `/${locale}`
  return `/${locale}${cleaned}`
}

/** Strip `/en` or `/de` from the start of a pathname. Leaves other paths alone. */
export function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/(en|de)(?=\/|$)/, '') || '/'
}

/** True if the pathname already starts with a known locale prefix. */
export function hasLocalePrefix(pathname: string): boolean {
  return SUPPORTED_LOCALES.some(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`),
  )
}
