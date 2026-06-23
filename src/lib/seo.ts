import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Per-doc SEO metadata builder. Reads the plugin-seo `meta` group
 * (configured in payload.config.ts) and emits a Next.js Metadata object
 * with title, description, canonical, openGraph, twitter, and — when the
 * page is rendered under an i18n route segment — hreflang alternates.
 *
 * Why this file exists
 * ────────────────────
 * Without an explicit `generateMetadata` per route, only the root layout's
 * `metadata` object reaches the HTML head. That means:
 *   - every page emits the same site-wide title + description
 *   - <link rel="canonical"> is never written
 *   - hreflang is never written (i18n sites)
 *   - the editor can fill plugin-seo's title/description/image in admin
 *     and they NEVER surface — a bug that hides indexing problems
 *     downstream (Search Console fills with "Crawled — currently not
 *     indexed" or "Duplicate without user-selected canonical")
 *
 * This helper centralises the wiring so every page route only writes:
 *
 *   export async function generateMetadata({ params }) {
 *     const doc = await fetchTheDoc(...)
 *     return buildPageMetadata(doc, { pathSuffix: 'about' })
 *   }
 *
 * Single-locale vs. multi-locale
 * ──────────────────────────────
 * - Default (no `opts.locale`): single-locale site. Canonical points to
 *   `${siteUrl}/${pathSuffix}`. No hreflang emitted.
 * - With `opts.locale` + the list in `MULTI_LOCALE_LOCALES`: emits
 *   canonical for the current locale plus hreflang for every locale and
 *   an `x-default` pointing at MULTI_LOCALE_DEFAULT. Activate when (and
 *   only when) you've wired up `src/proxy.ts` from
 *   `proxy.example.ts` and restructured routes under `[locale]/`.
 *
 * Image fallback chain (most specific → least specific)
 * ─────────────────────────────────────────────────────
 *   1. doc.meta.image       (editor pick in plugin-seo SEO tab)
 *   2. doc.cover            (collection-level cover/hero field)
 *   3. doc.coverImage       (alternate field name some collections use)
 *   4. SiteSettings.defaultOgImage  (site-wide fallback global)
 *
 * Title behaviour — the "doubled brand" trap
 * ──────────────────────────────────────────
 * The root layout sets `title.template: '%s — <SiteName>'`. plugin-seo's
 * generateTitle callback typically also appends the brand. If the editor
 * then types a full SEO title that already includes the brand (which the
 * plugin-seo UI encourages with its preview), Next.js' template would
 * double it: "Page Title — Brand — Brand".
 *
 * Fix: when `doc.meta.title` is set, we emit `title: { absolute }` which
 * skips the layout's template. When it isn't set, we fall back to
 * `${docTitle} — ${siteName}` and also use `absolute` so the template
 * still doesn't double-append. The layout's `template` only runs for
 * routes that call neither buildPageMetadata nor set their own title.
 */

type AnyDoc = {
  title?: string
  /** Some collections use `name` instead of `title` (events, artists, …) */
  name?: string
  excerpt?: string
  shortIntro?: string
  description?: string
  /** plugin-seo field group, default schema */
  meta?: {
    title?: string | null
    description?: string | null
    image?: { url?: string | null } | number | string | null
  } | null
  cover?: { url?: string | null } | number | null
  coverImage?: { url?: string | null } | number | null
}

export type SeoOpts = {
  /**
   * Path after the locale prefix (or after the site root in single-locale
   * mode), no leading slash. Examples: '' for the homepage, 'about',
   * 'work/atmosphere'. Drives canonical + hreflang URLs.
   */
  pathSuffix: string
  /**
   * Set only when the site is running in i18n mode (middleware active,
   * routes under [locale]/). Triggers hreflang emission.
   */
  locale?: string
}

// ──────────────────────────────────────────────────────────────────────
// Project-specific constants — adjust these once per project.
// ──────────────────────────────────────────────────────────────────────

/** Used only as a fallback when SiteSettings.siteName is empty. */
const SITE_NAME_FALLBACK = 'My Website'

/**
 * Locales rendered as `<link rel="alternate" hreflang="..." />` when the
 * page is rendered with `opts.locale`. Keep in sync with the locale list
 * in lib/locale.ts and payload.config.ts → `localization.locales`.
 */
const MULTI_LOCALE_LOCALES = ['en', 'de'] as const

/**
 * x-default hreflang target. Should match `payload.config.ts` →
 * `localization.defaultLocale`, since that's the version search engines
 * fall back to when no other hreflang matches.
 */
const MULTI_LOCALE_DEFAULT = 'en'

// ──────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

function buildUrl(pathSuffix: string, locale?: string): string {
  const base = siteUrl()
  const cleaned = pathSuffix.replace(/^\/+/, '')
  if (locale) {
    return cleaned ? `${base}/${locale}/${cleaned}` : `${base}/${locale}`
  }
  return cleaned ? `${base}/${cleaned}` : base
}

function buildAlternates(opts: SeoOpts) {
  // Single-locale mode: just canonical, no language alternates.
  if (!opts.locale) {
    return { canonical: buildUrl(opts.pathSuffix) }
  }
  // Multi-locale mode: canonical for current locale, hreflang for every
  // supported locale, plus x-default for the configured default locale.
  const languages: Record<string, string> = {}
  for (const loc of MULTI_LOCALE_LOCALES) {
    languages[loc] = buildUrl(opts.pathSuffix, loc)
  }
  languages['x-default'] = buildUrl(opts.pathSuffix, MULTI_LOCALE_DEFAULT)
  return {
    canonical: buildUrl(opts.pathSuffix, opts.locale),
    languages,
  }
}

function pickDocImageUrl(doc: AnyDoc | null | undefined): string | undefined {
  const ref = doc?.meta?.image ?? doc?.cover ?? doc?.coverImage ?? null
  if (typeof ref === 'object' && ref && 'url' in ref && ref.url) return ref.url
  return undefined
}

/**
 * Reads SiteSettings.siteName and SiteSettings.defaultOgImage. Wrapped in
 * try/catch so a DB hiccup never blocks metadata rendering — we'd rather
 * emit a generic title and no OG image than 500 the page.
 *
 * Result is cached per generateMetadata invocation by Next.js' fetch
 * cache + Payload's request-scoped cache, so this is effectively free
 * on a warm ISR page.
 */
async function fetchSiteDefaults(): Promise<{ siteName: string; ogImageUrl?: string }> {
  try {
    const p = await getPayload({ config })
    const settings = await p.findGlobal({ slug: 'site-settings', depth: 1 })
    const s = settings as {
      siteName?: string | null
      defaultOgImage?: { url?: string | null } | null
    }
    const siteName = (s.siteName && s.siteName.trim()) || SITE_NAME_FALLBACK
    const og = s.defaultOgImage
    const ogImageUrl = og && typeof og === 'object' && og.url ? og.url : undefined
    return { siteName, ogImageUrl }
  } catch {
    return { siteName: SITE_NAME_FALLBACK }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

/**
 * Build a Next.js Metadata object from a Payload doc and the page's
 * pathSuffix (and, in i18n mode, the active locale).
 *
 * Call this from `generateMetadata` in every page route. Even routes
 * with no Payload doc (404 fallbacks, search pages, …) can pass `null`
 * and still get correct canonical + brand-aware title behaviour.
 */
export async function buildPageMetadata(
  doc: AnyDoc | null | undefined,
  opts: SeoOpts,
): Promise<Metadata> {
  const { siteName, ogImageUrl: defaultOgImage } = await fetchSiteDefaults()

  const docTitle = doc?.title || doc?.name
  const metaTitle = doc?.meta?.title?.trim() || null
  const title = metaTitle
    ? metaTitle
    : docTitle
      ? `${docTitle} — ${siteName}`
      : siteName

  const description =
    doc?.meta?.description ||
    doc?.excerpt ||
    doc?.shortIntro ||
    doc?.description ||
    undefined

  const imageUrl = pickDocImageUrl(doc) ?? defaultOgImage
  const alternates = buildAlternates(opts)

  return {
    title: { absolute: title },
    description,
    alternates,
    openGraph: {
      title,
      description,
      siteName,
      url: alternates.canonical,
      type: 'website',
      ...(opts.locale ? { locale: ogLocaleTag(opts.locale) } : {}),
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  }
}

/**
 * Map a short locale code (e.g. 'de') to the OG locale tag format
 * (e.g. 'de_DE'). Extend this map when you add locales beyond the
 * default en/de pair.
 */
function ogLocaleTag(locale: string): string {
  const map: Record<string, string> = {
    de: 'de_DE',
    en: 'en_US',
  }
  return map[locale] || locale
}
