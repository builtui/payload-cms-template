'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ─── Custom Toggle ───

function ConsentToggle({ checked, onChange, disabled, label, description }: {
  checked: boolean
  onChange?: (value: boolean) => void
  disabled?: boolean
  label: string
  description: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={`flex items-start gap-3 text-left ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer group'}`}
    >
      <span
        className={`
          mt-0.5 shrink-0 w-9 h-5 rounded-full relative transition-colors duration-200
          ${checked
            ? 'bg-warm-white'
            : 'bg-warm-gray/30 group-hover:bg-warm-gray/50'
          }
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-200
            ${checked
              ? 'translate-x-4 bg-deep-black'
              : 'translate-x-0 bg-warm-gray'
            }
          `}
        />
      </span>
      <span>
        <span className="text-xs font-bold block">{label}</span>
        <span className="text-[11px] text-warm-gray block mt-0.5">{description}</span>
      </span>
    </button>
  )
}

// ─── Types ───

type ConsentState = {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  externalMedia: boolean
}

const COOKIE_KEY = 'hh-cookie-consent'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year in seconds

function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(COOKIE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function storeConsent(consent: ConsentState) {
  localStorage.setItem(COOKIE_KEY, JSON.stringify(consent))
  // Set a simple cookie so server can check consent exists
  document.cookie = `${COOKIE_KEY}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

// Global accessor for other components (e.g. video embeds)
export function hasConsent(category: keyof ConsentState): boolean {
  const consent = getStoredConsent()
  if (!consent) return false
  return consent[category]
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [consent, setConsent] = useState<ConsentState>({
    necessary: true,
    analytics: false,
    marketing: false,
    externalMedia: false,
  })

  useEffect(() => {
    const stored = getStoredConsent()
    if (!stored) {
      setVisible(true)
    }
  }, [])

  const accept = useCallback((state: ConsentState) => {
    storeConsent(state)
    setVisible(false)
    window.dispatchEvent(new CustomEvent('cookie-consent-update', { detail: state }))
  }, [])

  const acceptAll = useCallback(() => {
    accept({ necessary: true, analytics: true, marketing: true, externalMedia: true })
  }, [accept])

  const acceptNecessary = useCallback(() => {
    accept({ necessary: true, analytics: false, marketing: false, externalMedia: false })
  }, [accept])

  const acceptSelected = useCallback(() => {
    accept(consent)
  }, [accept, consent])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        backgroundColor: '#1A1A1A',
        color: '#F5F2ED',
      }}
    >
      <div className="edge py-6 md:py-8">
        {/* Main banner */}
        <div className="md:flex md:items-start md:justify-between md:gap-12">
          <div className="flex-1 max-w-[640px]">
            <p className="text-sm font-bold mb-2">Diese Website verwendet Cookies</p>
            <p className="text-xs leading-relaxed text-warm-gray">
              Wir nutzen Cookies und aehnliche Technologien, um die Funktionalitaet der Website
              sicherzustellen und Ihnen ein optimales Erlebnis zu bieten. Einige Cookies sind technisch
              notwendig, andere helfen uns, die Website zu verbessern oder externe Inhalte (z.B. Videos)
              einzubinden. Sie koennen Ihre Einwilligung jederzeit anpassen.
              Mehr Informationen finden Sie in unserer{' '}
              <Link href="/datenschutz" className="underline hover:text-warm-white">Datenschutzerklaerung</Link>.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2 mt-4 md:mt-0 md:shrink-0">
            <button
              onClick={acceptAll}
              className="text-xs font-bold tracking-[0.04em] px-6 py-2.5 bg-warm-white text-deep-black hover:bg-white transition-colors"
            >
              Alle akzeptieren
            </button>
            <button
              onClick={acceptNecessary}
              className="text-xs font-bold tracking-[0.04em] px-6 py-2.5 border border-warm-gray/30 text-warm-gray hover:text-warm-white hover:border-warm-white transition-colors"
            >
              Nur notwendige
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs tracking-[0.04em] px-6 py-2.5 text-warm-gray hover:text-warm-white transition-colors underline"
            >
              {showDetails ? 'Weniger anzeigen' : 'Einstellungen'}
            </button>
          </div>
        </div>

        {/* Detail settings */}
        {showDetails && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[640px]">
              {/* Necessary — always on */}
              <ConsentToggle
                checked={true}
                disabled={true}
                label="Notwendig"
                description="Für den Betrieb der Website erforderlich. Kann nicht deaktiviert werden."
              />

              {/* Analytics */}
              <ConsentToggle
                checked={consent.analytics}
                onChange={(v) => setConsent({ ...consent, analytics: v })}
                label="Statistik"
                description="Helfen uns zu verstehen, wie Besucher die Website nutzen (z.B. Seitenaufrufe)."
              />

              {/* Marketing */}
              <ConsentToggle
                checked={consent.marketing}
                onChange={(v) => setConsent({ ...consent, marketing: v })}
                label="Marketing"
                description="Werden verwendet, um Besuchern relevante Inhalte anzuzeigen."
              />

              {/* External Media */}
              <ConsentToggle
                checked={consent.externalMedia}
                onChange={(v) => setConsent({ ...consent, externalMedia: v })}
                label="Externe Medien"
                description="Erlaubt das Laden externer Inhalte (YouTube, Vimeo). Diese Dienste können Cookies setzen."
              />
            </div>

            <button
              onClick={acceptSelected}
              className="mt-4 text-xs font-bold tracking-[0.04em] px-6 py-2.5 border border-warm-gray/30 text-warm-gray hover:text-warm-white hover:border-warm-white transition-colors"
            >
              Auswahl speichern
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
