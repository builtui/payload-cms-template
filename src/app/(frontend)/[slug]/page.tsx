import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RenderBlocks } from '@/components/RenderBlocks'
import { notFound } from 'next/navigation'
import { buildPageMetadata } from '@/lib/seo'

export const revalidate = 60

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    // Only published pages get pre-rendered. Drafts are served via the
    // ?draft=true path on-demand for authenticated admins.
    const pages = await payload.find({
      collection: 'pages',
      limit: 100,
      where: { _status: { equals: 'published' } },
    })
    return pages.docs
      .filter((p: any) => p.slug !== 'home')
      .map((p: any) => ({ slug: p.slug }))
  } catch {
    // DB not reachable at build time — fall back to on-demand generation
    return []
  }
}

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ draft?: string }>

/**
 * Resolve whether the current request should see Draft content.
 * See homepage route for the full doc — same pattern.
 */
async function resolveDraftRequest(searchParams: SearchParams): Promise<boolean> {
  const sp = await searchParams
  if (sp?.draft !== 'true') return false
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    return Boolean(user)
  } catch {
    return false
  }
}

async function fetchPageBySlug(slug: string, draft: boolean) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'pages',
    where: draft
      ? { slug: { equals: slug } }
      : { slug: { equals: slug }, _status: { equals: 'published' } },
    limit: 1,
    draft,
  })
  return result.docs[0]
}

export default async function DynamicPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { slug } = await params
  const draft = await resolveDraftRequest(searchParams)
  const page = await fetchPageBySlug(slug, draft)
  if (!page) return notFound()

  return <RenderBlocks blocks={(page.layout as any[]) || []} />
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  // Metadata always uses published — share-targets / SEO crawlers
  // never see draft titles.
  const page = await fetchPageBySlug(slug, false).catch(() => null)
  // pathSuffix is the URL after the site root. Add { locale } here when
  // running in i18n mode — see proxy.example.ts.
  return buildPageMetadata(page as any, { pathSuffix: slug })
}
