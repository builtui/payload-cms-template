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

const SUPPORTED_LOCALES = ['en', 'de']

function hasLocalePrefix(path: string): boolean {
  return SUPPORTED_LOCALES.some(
    (loc) => path === `/${loc}` || path.startsWith(`/${loc}/`),
  )
}

/**
 * Resolve a Payload linkField into a concrete href.
 *
 * `locale` is optional:
 *   - if provided, all internal hrefs are prefixed with `/${locale}`
 *     (enables the i18n URL-segment pattern — see src/proxy.example.ts).
 *   - if omitted, hrefs stay unprefixed (legacy / non-i18n sites).
 */
function resolveUrl(link: LinkData, locale?: string): string | null {
  const prefix = locale ? `/${locale}` : ''

  // External URL (http, mailto, tel, etc. — pass through)
  // but for external links pointing to a relative path on the same site,
  // still apply the locale prefix unless it's already there.
  if (link.type === 'external' && link.url) {
    if (link.url.startsWith('/')) {
      return locale && !hasLocalePrefix(link.url) ? `${prefix}${link.url}` : link.url
    }
    return link.url
  }

  // Relationship-based internal link (from admin UI)
  if (link.reference) {
    const ref = link.reference
    const collection = ref.relationTo
    const doc = typeof ref.value === 'object' ? ref.value : null
    if (!doc?.slug) return null

    if (collection === 'pages' && doc.slug === 'home') return prefix || '/'
    const basePath = COLLECTION_PATHS[collection] || '/'
    return `${prefix}${basePath}${doc.slug}`
  }

  // Fallback: direct URL (from seed or manual entry)
  if (link.url) {
    if (link.url.startsWith('/')) {
      return locale && !hasLocalePrefix(link.url) ? `${prefix}${link.url}` : link.url
    }
    return link.url
  }

  return null
}

type Props = {
  link?: LinkData | null
  /** Current route locale. Pass to enable locale-prefixed hrefs (i18n URL segments). */
  locale?: string
  className?: string
  children?: React.ReactNode
  /** Show the auto-arrow icon after the label. Default: true. */
  showIcon?: boolean
}

export function SmartLink({
  link,
  locale,
  className = 'link text-sm font-bold tracking-[0.04em]',
  children,
  showIcon = true,
}: Props) {
  if (!link?.label) return null

  const href = resolveUrl(link, locale)
  if (!href) return null

  const isExternal =
    link.type === 'external' && !!link.url && !link.url.startsWith('/')
  const icon = showIcon ? (isExternal ? <ArrowUpRight /> : <ArrowRight />) : null

  if (isExternal) {
    return (
      <a
        href={href}
        target={link.newTab ? '_blank' : undefined}
        rel={link.newTab ? 'noopener noreferrer' : undefined}
        className={className}
      >
        {children || link.label}
        {icon && <> {icon}</>}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {children || link.label}
      {icon && <> {icon}</>}
    </Link>
  )
}
