import Link from 'next/link'
import { ArrowRight } from './icons/ArrowRight'
import { ArrowUpRight } from './icons/ArrowUpRight'

type LinkData = {
  type?: 'internal' | 'external'
  label?: string
  reference?: { relationTo: string; value: any } | null
  url?: string
  newTab?: boolean
}

const COLLECTION_PATHS: Record<string, string> = {
  pages: '/',
  events: '/programm/',
  artists: '/kuenstlerinnen/',
  projects: '/projekte/',
}

function resolveUrl(link: LinkData): string | null {
  if (link.type === 'external') return link.url || null

  // Relationship-based internal link (from admin UI)
  if (link.reference) {
    const ref = link.reference
    const collection = ref.relationTo
    const doc = typeof ref.value === 'object' ? ref.value : null
    if (!doc?.slug) return null

    const basePath = COLLECTION_PATHS[collection] || '/'
    if (collection === 'pages' && doc.slug === 'home') return '/'
    return `${basePath}${doc.slug}`
  }

  // Fallback: direct URL (from seed or manual entry)
  if (link.url) return link.url

  return null
}

type Props = {
  link?: LinkData | null
  className?: string
  children?: React.ReactNode
}

export function SmartLink({ link, className = 'link text-sm font-bold tracking-[0.04em]', children }: Props) {
  if (!link?.label) return null

  const href = resolveUrl(link)
  if (!href) return null

  const isExternal = link.type === 'external'
  const icon = isExternal ? <ArrowUpRight /> : <ArrowRight />

  if (isExternal) {
    return (
      <a
        href={href}
        target={link.newTab ? '_blank' : undefined}
        rel={link.newTab ? 'noopener noreferrer' : undefined}
        className={className}
      >
        {children || link.label} {icon}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {children || link.label} {icon}
    </Link>
  )
}
