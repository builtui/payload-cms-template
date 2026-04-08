import { getPayload } from 'payload'
import config from '@payload-config'
import { RenderBlocks } from '@/components/RenderBlocks'
import { notFound } from 'next/navigation'

export const revalidate = 60

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const pages = await payload.find({ collection: 'pages', limit: 100 })
  return pages.docs
    .filter((p: any) => p.slug !== 'home')
    .map((p: any) => ({ slug: p.slug }))
}

type Props = { params: Promise<{ slug: string }> }

export default async function DynamicPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const page = result.docs[0]
  if (!page) return notFound()

  return <RenderBlocks blocks={(page.layout as any[]) || []} />
}
