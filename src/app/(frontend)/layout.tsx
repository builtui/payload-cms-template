import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Header } from '@/components/Header'
import { HeaderScroll } from '@/components/HeaderScroll'
import { Footer } from '@/components/Footer'
import { CookieBanner } from '@/components/CookieBanner'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'My Website',
    template: '%s — My Website',
  },
  description: 'Your site description here.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'My Website',
  },
}

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  let navItems: { label: string; url: string }[] = []
  let siteSettings: any = {}
  let footer: any = {}

  try {
    const payload = await getPayload({ config })

    const [navigation, siteSettingsData, footerData] = await Promise.all([
      payload.findGlobal({ slug: 'navigation' }),
      payload.findGlobal({ slug: 'site-settings' }),
      payload.findGlobal({ slug: 'footer' }),
    ])

    navItems = (navigation.items || []).map((item: any) => ({
      label: item.label,
      url: item.url,
    }))
    siteSettings = siteSettingsData
    footer = footerData
  } catch (_) {
    // Globals may not exist yet
  }

  const addressShort = [siteSettings.address?.street, siteSettings.address?.city].filter(Boolean).join(', ')

  return (
    <html lang="de">
      <body className="font-sans">
        <a href="#main-content" className="skip-link">Zum Inhalt springen</a>
        <Header navItems={navItems} addressShort={addressShort} instagram={siteSettings.instagram} />
        <HeaderScroll />
        <main id="main-content">{children}</main>
        <Footer
          navItems={navItems}
          siteName={siteSettings.siteName || ''}
          address={{
            street: siteSettings.address?.street || '',
            zip: siteSettings.address?.zip || '',
            city: siteSettings.address?.city || '',
          }}
          email={siteSettings.email || ''}
          openingHours={siteSettings.openingHours || ''}
          instagram={siteSettings.instagram || undefined}
          facebook={siteSettings.facebook || undefined}
          sponsorLabel={footer.sponsorLabel || ''}
          sponsorLogo={footer.sponsorLogo && typeof footer.sponsorLogo === 'object' ? { url: footer.sponsorLogo.url, alt: footer.sponsorLogo.alt } : null}
          legalLinks={(footer.legalLinks || []).map((l: any) => ({ label: l.label, url: l.url }))}
        />
        <CookieBanner />
      </body>
    </html>
  )
}
