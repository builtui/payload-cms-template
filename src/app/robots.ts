import type { MetadataRoute } from 'next'

/**
 * robots.txt — tells search engines which paths to crawl.
 *
 * We disallow /admin and /api because those are for internal use.
 * Everything else (pages, events, artists, projects) is indexable.
 *
 * The sitemap URL helps crawlers discover all pages quickly.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
