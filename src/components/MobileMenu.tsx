'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

type NavItem = { label: string; url: string }

type Props = {
  navItems: NavItem[]
  addressShort?: string
  instagram?: string
}

/**
 * Full-viewport mobile menu. Two non-obvious choices baked in:
 *
 * 1. Overlay covers the FULL viewport (top: 0, height: 100dvh) — not
 *    `top: 56px` with the header poking through. A semi-transparent
 *    header on top of the overlay would let page content shimmer through.
 *    The trade-off: the header's close button is now hidden behind the
 *    overlay, so we render an in-overlay close button as a replacement.
 *
 * 2. `100dvh` instead of `100vh`: iOS Safari's collapsing toolbar makes
 *    `100vh` overshoot the visible area. `dvh` tracks the dynamic viewport.
 *
 * The component is portaled into `document.body` to escape ancestor
 * stacking contexts (the header's `z-50`) and to dodge the `position: fixed`
 * containing-block trap (any ancestor with `transform`, `filter`,
 * `perspective`, or `will-change` re-anchors `position: fixed`).
 */
export function MobileMenu({ navItems, addressShort, instagram }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const open = useCallback(() => {
    setIsOpen(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true))
    })
  }, [])

  const close = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => setIsOpen(false), 300)
  }, [])

  const overlay = isOpen && mounted
    ? createPortal(
        <div
          role="dialog"
          aria-label="Navigation"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            backgroundColor: 'rgba(245, 242, 237, 0.97)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            clipPath: isVisible ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
            transition: 'clip-path 0.3s ease-out',
          }}
        >
          {/* In-overlay close button — replaces the header's button while open */}
          <div className="flex justify-end px-6 pt-6 pb-2">
            <button
              type="button"
              onClick={close}
              className="text-[12px] font-bold tracking-[0.1em] uppercase"
              aria-label="Menü schliessen"
            >
              Schliessen
            </button>
          </div>

          <nav className="flex-1 flex flex-col justify-center px-6 gap-4">
            {navItems.map((item) => (
              <Link
                key={item.url}
                href={item.url}
                onClick={close}
                className="text-[13vw] sm:text-[56px] font-bold leading-[0.95] tracking-[-0.03em]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="px-6 pb-8 flex justify-between text-xs text-warm-gray">
            {addressShort && <span>{addressShort}</span>}
            {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer" className="link">Instagram</a>}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        onClick={open}
        className="md:hidden text-[12px] font-bold tracking-[0.1em] uppercase"
        aria-expanded={isOpen}
        aria-controls="mobile-nav"
      >
        Menu
      </button>
      {overlay}
    </>
  )
}
