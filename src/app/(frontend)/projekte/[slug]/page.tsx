import { getPayload } from 'payload'
import config from '@payload-config'
import { RenderBlocks } from '@/components/RenderBlocks'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ slug: string }> }

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'projects',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const project = result.docs[0]
  if (!project) return notFound()

  return <RenderBlocks blocks={(project.layout as any[]) || []} />
}
