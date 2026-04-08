import React from 'react'

type Spacing = 'none' | 'sm' | 'md' | 'lg' | 'xl'
type Background = 'transparent' | 'warm-white' | 'deep-black'

export type WrapperProps = {
  paddingTop?: Spacing
  paddingBottom?: Spacing
  background?: Background
  dividerTop?: boolean
  dividerBottom?: boolean
}

type BlockWrapperProps = {
  children: React.ReactNode
  paddingTop?: Spacing
  paddingBottom?: Spacing
  background?: Background
  dividerTop?: boolean
  dividerBottom?: boolean
  noEdge?: boolean
  overflow?: boolean
  headerOffset?: boolean
  className?: string
}

const ptClasses: Record<Spacing, string> = {
  none: '',
  sm: 'pt-10 md:pt-16',
  md: 'pt-16 md:pt-24',
  lg: 'pt-16 md:pt-28',
  xl: 'pt-20 md:pt-32',
}

const pbClasses: Record<Spacing, string> = {
  none: '',
  sm: 'pb-10 md:pb-16',
  md: 'pb-16 md:pb-24',
  lg: 'pb-16 md:pb-28',
  xl: 'pb-20 md:pb-32',
}

const bgClasses: Record<Background, string> = {
  transparent: '',
  'warm-white': 'bg-warm-white',
  'deep-black': 'bg-deep-black text-warm-white',
}

export function BlockWrapper({
  children,
  paddingTop = 'none',
  paddingBottom = 'md',
  background = 'transparent',
  dividerTop = false,
  dividerBottom = false,
  noEdge = false,
  overflow = false,
  headerOffset = false,
  className = '',
}: BlockWrapperProps) {
  const sectionClasses = [
    ptClasses[paddingTop],
    pbClasses[paddingBottom],
    bgClasses[background],
    overflow && 'overflow-hidden',
    headerOffset && 'pt-14 md:pt-16',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const dividerTopEl = dividerTop ? (
    <div className="border-t border-deep-black pt-12 md:pt-16" />
  ) : null

  const dividerBottomEl = dividerBottom ? (
    <div className="border-b border-deep-black" />
  ) : null

  if (noEdge) {
    return (
      <section className={sectionClasses || undefined}>
        {dividerTopEl && <div className="edge">{dividerTopEl}</div>}
        {children}
        {dividerBottomEl && <div className="edge">{dividerBottomEl}</div>}
      </section>
    )
  }

  return (
    <section className={sectionClasses || undefined}>
      <div className="edge">
        {dividerTopEl}
        {children}
        {dividerBottomEl}
      </div>
    </section>
  )
}
