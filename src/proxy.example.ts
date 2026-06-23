import { NextResponse, type NextRequest } from 'next/server'
import { detectLocale } from './lib/detectLocale'

/**
 * i18n URL-segment proxy — OPT-IN.
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy` (nodejs
 * runtime; edge is no longer supported for it). This example is the `proxy`
 * form. If you are still on Next 15 or need the edge runtime, use the
 * `middleware` filename + `export function middleware` instead — the logic is
 * identical.
 *
 * ──────────────────────────────────────────────────────────────────
 * HOW TO ACTIVATE
 * ──────────────────────────────────────────────────────────────────
 *   1. Rename this file to `src/proxy.ts`.
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
 *   5. Update each route's `generateMetadata` to pass `{ locale }` into
 *      `buildPageMetadata` from `lib/seo.ts`. Without this, the canonical
 *      will point at `/about` instead of `/de/about` and hreflang tags
 *      won't render at all. The helper's `SeoOpts.locale` is the i18n
 *      switch — set it and you get full hreflang/x-default emission.
 *      See `docs/SEO.md` for the wiring pattern.
 *
 *   6. Update `sitemap.ts` to emit one entry per locale per URL with
 *      `alternates.languages` — Google reads both HTML hreflang and
 *      sitemap hreflang. See the example block at the top of that file.
 *
 * ──────────────────────────────────────────────────────────────────
 * WHAT IT DOES
 * ──────────────────────────────────────────────────────────────────
 *   - Any request without a locale prefix gets 308-redirected to
 *     `/{detected-locale}{pathname}` (cookie > Accept-Language > default).
 *     308 is used (not 307) because the localized URL is the canonical
 *     URL for search engines — a permanent redirect signals that.
 *   - Already-prefixed requests pass through via `NextResponse.next()`
 *     with an `x-pathname` header (the `[locale]` route serves them
 *     natively — NO rewrite). This is the recommended approach and is
 *     free of the Next-16 proxy rewrite pitfalls described below.
 *
 * ──────────────────────────────────────────────────────────────────
 * ALTERNATIVE: URL-prefix WITHOUT `[locale]` folders (rewrite approach)
 * ──────────────────────────────────────────────────────────────────
 * If you cannot move routes under `[locale]/`, you can instead REWRITE
 * `/de/x` → `/x` onto the existing routes and signal the locale via a
 * header. On Next 16's nodejs proxy this has TWO sharp edges — both cause
 * a prod-only outage (dev looks fine). See docs/KNOWN-ISSUES.md → i18n.
 *
 *   a) The proxy RE-RUNS on its own internal rewrite, now on the
 *      un-prefixed path → the redirect branch fires → `/de` 307-loops to
 *      itself. Guard at the top of the function:
 *        if (req.headers.get('x-locale')) return NextResponse.next()
 *      and set `x-locale` on the rewrite's forwarded request headers.
 *
 *   b) The nodejs proxy FETCHES the rewrite target. Behind a TLS-terminating
 *      nginx it inherits `X-Forwarded-Proto: https` and fetches
 *      `https://localhost:3000` → TLS against the plaintext port → EPROTO
 *      500 on every page. Pin the target to the internal plaintext origin:
 *        const target = new URL(`${url.pathname}${url.search}`,
 *                               `http://127.0.0.1:${process.env.PORT || 3000}`)
 *        return NextResponse.rewrite(target, { request: { headers } })
 *
 * The matcher explicitly excludes /api, /admin, /_next and any path
 * with a dot in the last segment (static files like .svg, .png, etc.).
 */

const SUPPORTED = ['en', 'de'] as const

export function proxy(req: NextRequest) {
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
    // 308 (permanent) so search engines treat /{locale}/... as the
    // canonical landing URL and apply ranking signals there. The locale
    // switcher should link directly to `/de/...` / `/en/...` rather than
    // routing through `/`, so a browser-cached 308 doesn't block changes.
    return NextResponse.redirect(url, 308)
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
