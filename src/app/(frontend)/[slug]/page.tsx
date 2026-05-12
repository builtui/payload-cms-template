import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RenderBlocks } from '@/components/RenderBlocks'
import { notFound } from 'next/navigation'
import { buildPageMetadata } from '@/lib/seo'

export const revalidate = 60

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config })
    const pages = await payload.find({ collection: 'pages', limit: 100 })
    return pages.docs
      .filter((p: any) => p.slug !== 'home')
      .map((p: any) => ({ slug: p.slug }))
  } catch {
    // DB not reachable at build time — fall back to on-demand generation
    return []
  }
}

type Props = { params: Promise<{ slug: string }> }

async function fetchPageBySlug(slug: string) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  return result.docs[0]
}

export default async function DynamicPage({ params }: Props) {
  const { slug } = await params
  const page = await fetchPageBySlug(slug)
  if (!page) return notFound()

  return <RenderBlocks blocks={(page.layout as any[]) || []} />
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await fetchPageBySlug(slug).catch(() => null)
  // pathSuffix is the URL after the site root. Add { locale } here when
  // running in i18n mode — see middleware.example.ts.
  return buildPageMetadata(page as any, { pathSuffix: slug })
}
