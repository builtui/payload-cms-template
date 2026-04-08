import { getPayload } from 'payload'
import config from '@payload-config'
import { BlockWrapper, type WrapperProps } from '@/components/BlockWrapper'
import { ArrowUpRight } from '@/components/icons/ArrowUpRight'

type Props = {
  showMap?: boolean
  showDirections?: boolean
  directions?: any
  accessibility?: any
  wrapper?: WrapperProps
}

export async function KeyInfoBlockBlock({ wrapper }: Props) {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'site-settings' })

  return (
    <BlockWrapper {...wrapper} paddingBottom={wrapper?.paddingBottom || 'md'} dividerTop={wrapper?.dividerTop ?? true}>
      <div className="md:grid md:grid-cols-12 gap-6 md:gap-8">
        {/* Left: Big info blocks */}
        <div className="md:col-span-6 lg:col-span-5">
          <div className="mb-10 md:mb-12">
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">Adresse</span>
            <p className="text-2xl md:text-3xl font-bold tracking-[-0.02em] mt-2 leading-tight">
              {settings.address?.street}<br />
              {settings.address?.zip} {settings.address?.city}
            </p>
          </div>
          <div className="mb-10 md:mb-12">
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">Oeffnungszeiten</span>
            <p className="text-2xl md:text-3xl font-bold tracking-[-0.02em] mt-2">{settings.openingHours}</p>
            <p className="text-sm text-anthracite mt-2">Waehrend Veranstaltungen abweichende Zeiten moeglich. Bitte Programm beachten.</p>
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">Eintritt</span>
            <p className="text-2xl md:text-3xl font-bold tracking-[-0.02em] mt-2">Frei</p>
            <p className="text-sm text-anthracite mt-2">Fuer einzelne Workshops kann eine Teilnahmegebuehr anfallen.</p>
          </div>
        </div>

        {/* Right: Contact, Träger, Social */}
        <div className="md:col-span-6 lg:col-span-5 lg:col-start-7 mt-10 md:mt-0">
          <div className="mb-10 md:mb-12">
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">Kontakt</span>
            <p className="text-base mt-3">
              <a href={`mailto:${settings.email}`} className="link font-medium">{settings.email}</a>
            </p>
          </div>

          <div className="border-t border-line pt-8 mb-10 md:mb-12">
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">Traeger</span>
            <p className="text-sm text-anthracite mt-3 leading-relaxed">
              Hugenottenhaus gGmbH<br />
              in Kooperation mit Moving School e.V.
            </p>
          </div>

          <div className="border-t border-line pt-8">
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-warm-gray">Folgen</span>
            <div className="flex gap-6 mt-3 text-sm">
              {settings.instagram && (
                <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="link font-medium">
                  Instagram <ArrowUpRight />
                </a>
              )}
              {settings.facebook && (
                <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="link font-medium">
                  Facebook <ArrowUpRight />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}
