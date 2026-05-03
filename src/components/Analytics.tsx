'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// Must match the storage key the project's CookieBanner writes to.
// Template default lives in `src/components/CookieBanner.tsx` as `COOKIE_KEY`.
const COOKIE_KEY = 'cookie-consent'

type ConsentState = {
  necessary?: boolean
  analytics?: boolean
  marketing?: boolean
  externalMedia?: boolean
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Google Analytics 4 loader, GATED on the user's cookie-consent.
 *
 * The contract with the cookie banner:
 *
 * - On mount: read consent from localStorage[COOKIE_KEY] (returning visitors
 *   who already accepted in a previous session).
 * - At runtime: subscribe to the `cookie-consent-update` CustomEvent that
 *   CookieBanner dispatches when the user accepts in this session — so the
 *   tracker activates without a page reload.
 *
 * The gtag.js script tag only renders when both:
 *   1. an `analytics` consent is granted, AND
 *   2. a Measurement ID prop is supplied.
 *
 * Until then no Google network request fires, no cookies are set. This is
 * the GDPR Art. 6 (1) (a) "informed consent" requirement.
 *
 * Caveat: gtag.js cannot be cleanly unloaded once mounted. Revoke (which is
 * not exposed in the default banner UI) only takes effect on next reload.
 *
 * SPA tracking: Next.js client-side route changes don't trigger gtag's
 * default page_view. We fire a manual page_view event on every pathname
 * change so the GA SPA flow records all navigation.
 *
 * Use in `src/app/(frontend)/layout.tsx` (or `[locale]/layout.tsx`):
 *
 *   const settings = await payload.findGlobal({ slug: 'site-settings' })
 *   <Analytics id={settings.analyticsId} />
 *
 * The Measurement ID typically lives on the `site-settings` global as a
 * `text` field — see `src/globals/SiteSettings.ts` for the field config.
 */
export function Analytics({ id }: { id?: string | null }) {
  const [allowed, setAllowed] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    // Initial sync from storage (returning visitor)
    try {
      const raw = localStorage.getItem(COOKIE_KEY)
      if (raw) {
        const consent = JSON.parse(raw) as ConsentState
        if (consent?.analytics) setAllowed(true)
      }
    } catch {
      // localStorage unavailable (Safari private mode etc.) — leave disabled.
    }

    const onUpdate = (e: Event) => {
      const consent = (e as CustomEvent<ConsentState>).detail
      if (consent?.analytics) setAllowed(true)
    }
    window.addEventListener('cookie-consent-update', onUpdate)
    return () => window.removeEventListener('cookie-consent-update', onUpdate)
  }, [])

  // Manual SPA pageview tracking — gtag.js only auto-fires on initial config.
  useEffect(() => {
    if (!allowed || !id || typeof window.gtag !== 'function') return
    window.gtag('event', 'page_view', { page_path: pathname })
  }, [allowed, id, pathname])

  if (!id || !allowed) return null

  return (
    <>
      <Script
        id="ga-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  )
}
