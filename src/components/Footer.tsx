import Link from 'next/link'
import { ArrowUpRight } from './icons/ArrowUpRight'

type FooterProps = {
  navItems: { label: string; url: string }[]
  address: { street: string; zip: string; city: string }
  email: string
  openingHours: string
  instagram?: string
  facebook?: string
  sponsorLabel?: string
  sponsorLogo?: { url: string; alt: string } | null
  legalLinks: { label: string; url: string }[]
}

export function Footer(props: FooterProps) {
  const { navItems, address, email, openingHours, instagram, facebook, sponsorLabel, sponsorLogo, legalLinks } = props

  return (
    <footer className="bg-deep-black text-warm-white">
      <div className="edge py-12 md:py-[5rem]">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 md:gap-6">
          {/* Logos */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src="/images/hugenottenhaus-logo.svg" alt="Hugenottenhaus" className="h-9 w-auto invert" />
            </div>
            <img src="/images/moving-school-logo.svg" alt="Moving School" className="h-[1.75rem] w-auto brightness-0 invert mt-2 opacity-80" />
          </div>
          {/* Nav */}
          <div>
            <nav className="flex flex-col gap-2.5 text-[13px]">
              {navItems.map((item) => (
                <Link key={item.url} href={item.url} className="text-warm-gray hover:text-warm-white transition-colors">{item.label}</Link>
              ))}
            </nav>
          </div>
          {/* Contact */}
          <div className="text-[13px]">
            <p className="text-warm-gray leading-relaxed">{address.street}<br />{address.zip} {address.city}</p>
            <p className="text-warm-gray mt-3"><a href={`mailto:${email}`} className="hover:text-warm-white transition-colors">{email}</a></p>
          </div>
          {/* Hours */}
          <div className="text-[13px]">
            <p className="text-warm-gray">Oeffnungszeiten</p>
            <p className="text-warm-white font-medium mt-1">{openingHours}</p>
          </div>
          {/* Social */}
          <div className="text-[13px]">
            <p className="text-warm-gray mb-3">Folgen</p>
            <div className="flex flex-col gap-2">
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer" className="text-warm-gray hover:text-warm-white transition-colors">
                  Instagram <ArrowUpRight />
                </a>
              )}
              {facebook && (
                <a href={facebook} target="_blank" rel="noopener noreferrer" className="text-warm-gray hover:text-warm-white transition-colors">
                  Facebook <ArrowUpRight />
                </a>
              )}
            </div>
          </div>
          {/* Foerderer */}
          {sponsorLogo && (
            <div>
              <p className="text-[11px] text-warm-gray/50 mb-3">{sponsorLabel}</p>
              <img src={sponsorLogo.url} alt={sponsorLogo.alt} className="h-12 w-auto" />
            </div>
          )}
        </div>
        {/* Bottom bar */}
        <div className="border-t border-white/10 mt-10 pt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <p className="text-[11px] text-warm-gray/40">&copy; {new Date().getFullYear()} Hugenottenhaus Kassel</p>
          <div className="flex gap-6 text-[11px] text-warm-gray/50">
            {legalLinks.map((link) => (
              <Link key={link.url} href={link.url} className="hover:text-warm-gray transition-colors">{link.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
