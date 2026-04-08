import { getPayload } from 'payload'
import config from '@payload-config'
import { RenderBlocks } from '@/components/RenderBlocks'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ slug: string }> }

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'events',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const event = result.docs[0]
  if (!event) return notFound()

  return <RenderBlocks blocks={(event.layout as any[]) || []} />
}
