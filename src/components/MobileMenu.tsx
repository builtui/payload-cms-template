'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

type NavItem = { label: string; url: string }

export function MobileMenu({ navItems }: { navItems: NavItem[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
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
          style={{
            position: 'fixed',
            top: '56px', // h-14 = 3.5rem = 56px — starts below header
            left: 0,
            width: '100vw',
            height: 'calc(100vh - 56px)',
            backgroundColor: 'rgba(245, 242, 237, 0.90)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            clipPath: isVisible ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
            transition: 'clip-path 0.3s ease-out',
          }}
        >
          {/* Nav links — centered vertically */}
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

          {/* Bottom bar */}
          <div className="px-6 pb-8 flex justify-between text-xs text-warm-gray">
            <span>Friedrichsstr. 25, Kassel</span>
            <a href="#" className="link">Instagram</a>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        onClick={isOpen ? close : open}
        className="md:hidden text-[12px] font-bold tracking-[0.1em] uppercase"
      >
        {isOpen ? 'Schliessen' : 'Menu'}
      </button>
      {overlay}
    </>
  )
}
