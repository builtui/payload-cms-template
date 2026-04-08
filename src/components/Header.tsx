import Link from 'next/link'
import { NavLinks } from './NavLinks'
import { MobileMenu } from './MobileMenu'

type NavItem = { label: string; url: string }

export function Header({ navItems }: { navItems: NavItem[] }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-warm-white/90 backdrop-blur-sm">
      <div className="edge flex items-center justify-between h-14 md:h-16">
        <div className="flex items-center">
          <Link href="/" className="shrink-0">
            <img src="/images/hugenottenhaus-logo.svg" alt="Hugenottenhaus" className="h-8 md:h-9 w-auto" />
          </Link>
          <div className="w-px h-7 bg-line mx-3" />
          <span className="shrink-0">
            <img src="/images/moving-school-logo.svg" alt="Moving School" className="h-[2rem] w-auto" />
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-7">
          <NavLinks items={navItems} />
          <span className="text-[12px] font-medium text-warm-gray cursor-pointer hover:text-deep-black transition-colors ml-2">DE / EN</span>
        </nav>
        <MobileMenu navItems={navItems} />
      </div>
      <div className="header-line border-b border-line opacity-0 transition-opacity duration-200" />
    </header>
  )
}
