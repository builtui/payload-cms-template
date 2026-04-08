'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { label: string; url: string }

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <>
      {items.map((item) => {
        const isActive = pathname === item.url || pathname.startsWith(item.url + '/')
        return (
          <Link
            key={item.url}
            href={item.url}
            className={`nav-link text-[12px] font-bold tracking-[0.1em] uppercase ${isActive ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}
