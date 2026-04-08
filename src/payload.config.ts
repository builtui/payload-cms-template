import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { seoPlugin } from '@payloadcms/plugin-seo'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Events } from './collections/Events'
import { Artists } from './collections/Artists'
import { Projects } from './collections/Projects'
import { Pages } from './collections/Pages'
import { SiteSettings } from './globals/SiteSettings'
import { Navigation } from './globals/Navigation'
import { Footer } from './globals/Footer'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    livePreview: {
      url: ({ data, collectionConfig }) => {
        if (collectionConfig?.slug === 'pages') {
          const slug = (data as any)?.slug
          return slug === 'home' ? '/' : `/${slug}`
        }
        if (collectionConfig?.slug === 'events') return `/programm/${(data as any)?.slug}`
        if (collectionConfig?.slug === 'artists') return `/kuenstlerinnen/${(data as any)?.slug}`
        if (collectionConfig?.slug === 'projects') return `/projekte/${(data as any)?.slug}`
        return '/'
      },
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 375, height: 667 },
        { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
      collections: ['pages', 'events', 'artists', 'projects'],
    },
  },
  collections: [Users, Media, Events, Artists, Projects, Pages],
  globals: [SiteSettings, Navigation, Footer],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  localization: {
    locales: [
      { label: 'Deutsch', code: 'de' },
      { label: 'English', code: 'en' },
    ],
    defaultLocale: 'de',
    fallback: true,
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [
    seoPlugin({
      collections: ['pages', 'events', 'artists', 'projects'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }: any) => doc?.title ? `${doc.title} — Hugenottenhaus Kassel` : 'Hugenottenhaus Kassel',
      generateDescription: ({ doc }: any) => doc?.description || '',
    }),
  ],
})
