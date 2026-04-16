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
