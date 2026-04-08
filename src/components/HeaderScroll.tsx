'use client'

import { useEffect } from 'react'

export function HeaderScroll() {
  useEffect(() => {
    const onScroll = () => {
      const line = document.querySelector('.header-line') as HTMLElement | null
      if (line) line.style.opacity = window.scrollY > 60 ? '1' : '0'
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return null
}
