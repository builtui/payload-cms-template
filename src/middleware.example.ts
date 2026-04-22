import { NextResponse, type NextRequest } from 'next/server'
import { detectLocale } from './lib/detectLocale'

/**
 * i18n URL-segment middleware — OPT-IN.
 *
 * ──────────────────────────────────────────────────────────────────
 * HOW TO ACTIVATE
 * ──────────────────────────────────────────────────────────────────
 *   1. Rename this file to `src/middleware.ts`.
 *   2. Restructure your routes under `src/app/(frontend)/[locale]/…`
 *      (move existing pages into that folder).
 *   3. Add `generateStaticParams` to the [locale]/layout.tsx:
 *
 *        export function generateStaticParams() {
 *          return SUPPORTED_LOCALES.map((locale) => ({ locale }))
 *        }
 *
 *   4. Read `params.locale` in every page/layout that needs it; pass
 *      it as prop to child components. Avoid calling `currentLocale()`
 *      from lib/locale.ts in leaf components (would make them dynamic).
 *
 * ──────────────────────────────────────────────────────────────────
 * WHAT IT DOES
 * ──────────────────────────────────────────────────────────────────
 *   - Any request without a locale prefix gets 307-redirected to
 *     `/{detected-locale}{pathname}` (cookie > Accept-Language > default).
 *   - Already-prefixed requests pass through with an `x-pathname`
 *     header, so server components can read the active locale via
 *     `currentLocale()` in lib/locale.ts if needed.
 *
 * The matcher explicitly excludes /api, /admin, /_next and any path
 * with a dot in the last segment (static files like .svg, .png, etc.).
 */

const SUPPORTED = ['en', 'de'] as const

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const hasLocale = SUPPORTED.some(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`),
  )

  if (!hasLocale) {
    const cookieLocale = req.cookies.get('pref-locale')?.value
    const accept = req.headers.get('accept-language')
    const locale = detectLocale(cookieLocale, accept)

    const url = req.nextUrl.clone()
    url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
    return NextResponse.redirect(url)
  }

  // Forward pathname so server components can read the active locale
  // without re-parsing the URL (via currentLocale() in lib/locale.ts).
  const headers = new Headers(req.headers)
  headers.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|admin|.*\\..*).*)'],
}
