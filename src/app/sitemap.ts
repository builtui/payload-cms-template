import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * sitemap.xml — auto-generated from the database.
 *
 * Queries all Pages and builds a sitemap entry per slug.
 * The `home` slug maps to `/`, everything else to `/{slug}`.
 *
 * When you add more collections (events, artists, projects, etc.),
 * extend this file with additional queries + URL patterns that match
 * your route structure in app/(frontend)/.
 *
 * Example for a custom collection:
 *
 *   const events = await payload.find({ collection: 'events', limit: 1000 })
 *   for (const event of events.docs as any[]) {
 *     entries.push({
 *       url: `${baseUrl}/events/${event.slug}`,
 *       lastModified: new Date(event.updatedAt),
 *       changeFrequency: 'weekly',
 *       priority: 0.7,
 *     })
 *   }
 *
 * ──────────────────────────────────────────────────────────────────
 * i18n MODE — emit one entry per locale + hreflang alternates
 * ──────────────────────────────────────────────────────────────────
 * When you activate `middleware.example.ts` and restructure routes
 * under `[locale]/`, every URL needs to appear once per locale, and
 * each entry needs `alternates.languages` so Google can pair them.
 *
 * Replace the loop above with something like:
 *
 *   const LOCALES = ['en', 'de'] as const
 *
 *   function pushLocalized(suffix: string, lastMod?: Date, priority?: number) {
 *     const languages: Record<string, string> = {}
 *     for (const loc of LOCALES) {
 *       languages[loc] = suffix
 *         ? `${baseUrl}/${loc}/${suffix}`
 *         : `${baseUrl}/${loc}`
 *     }
 *     for (const loc of LOCALES) {
 *       entries.push({
 *         url: languages[loc],
 *         lastModified: lastMod,
 *         priority,
 *         alternates: { languages },
 *       })
 *     }
 *   }
 *
 *   for (const page of pages.docs as any[]) {
 *     const suffix = page.slug === 'home' ? '' : page.slug
 *     pushLocalized(suffix, new Date(page.updatedAt), page.slug === 'home' ? 1.0 : 0.8)
 *   }
 *
 * Google reads BOTH HTML hreflang AND sitemap hreflang. Emitting both
 * (this file + lib/seo.ts) costs nothing and is the most reliable
 * pairing signal.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    const payload = await getPayload({ config })

    const pages = await payload.find({ collection: 'pages', limit: 1000, depth: 0 })

    const entries: MetadataRoute.Sitemap = []

    // Pages: home → /, everything else → /slug
    for (const page of pages.docs as any[]) {
      const url = page.slug === 'home' ? baseUrl : `${baseUrl}/${page.slug}`
      entries.push({
        url,
        lastModified: new Date(page.updatedAt),
        changeFrequency: 'weekly',
        priority: page.slug === 'home' ? 1.0 : 0.8,
      })
    }

    return entries
  } catch (err) {
    console.error('Sitemap generation failed:', err)
    return []
  }
}
