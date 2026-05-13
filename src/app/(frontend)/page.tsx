import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RenderBlocks } from '@/components/RenderBlocks'
import { buildPageMetadata } from '@/lib/seo'

export const revalidate = 60 // Re-generate every 60 seconds

type SearchParams = Promise<{ draft?: string }>

/**
 * Resolve whether the current request should see Draft content.
 * Two conditions must be true:
 *  - URL carries `?draft=true` (opt-in by Payload livePreview iframe)
 *  - Request has an authenticated Payload session cookie
 *
 * Anonymous visitors with `?draft=true` get nothing extra (auth fails →
 * returns false), so the page stays safe for sharing draft URLs by
 * accident. Public visitors hit the static path with no draft= param,
 * so the cached published version is served.
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

async function fetchHome(draft: boolean) {
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'pages',
    where: draft
      ? { slug: { equals: 'home' } }
      : { slug: { equals: 'home' }, _status: { equals: 'published' } },
    limit: 1,
    draft,
  })
  return found.docs[0]
}

export async function generateMetadata(): Promise<Metadata> {
  // Metadata always uses the published version — share-targets shouldn't
  // see draft titles.
  const home = await fetchHome(false).catch(() => null)
  return buildPageMetadata(home as any, { pathSuffix: '' })
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const draft = await resolveDraftRequest(searchParams)
  try {
    const data = await fetchHome(draft)
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
