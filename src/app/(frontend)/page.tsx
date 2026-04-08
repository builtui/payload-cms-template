import { getPayload } from 'payload'
import config from '@payload-config'
import { RenderBlocks } from '@/components/RenderBlocks'

export const revalidate = 60 // Re-generate every 60 seconds

export default async function HomePage() {
  const payload = await getPayload({ config })

  try {
    const page = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'home' } },
      limit: 1,
    })

    const data = page.docs[0]
    if (!data) {
      return (
        <div className="edge pt-24 min-h-[60vh]">
          <h1 className="text-[14vw] md:text-[11.5vw] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase">
            Kunst, Kultur &amp; Begegnung
          </h1>
          <p className="text-lg text-anthracite mt-8">Bitte erstelle eine Seite mit Slug &quot;home&quot; im Admin-Panel.</p>
        </div>
      )
    }

    return <RenderBlocks blocks={(data.layout as any[]) || []} />
  } catch {
    return (
      <div className="edge pt-24 min-h-[60vh]">
        <h1 className="text-[14vw] md:text-[11.5vw] font-extrabold leading-[0.88] tracking-[-0.04em] uppercase">
          Hugenottenhaus Kassel
        </h1>
      </div>
    )
  }
}
