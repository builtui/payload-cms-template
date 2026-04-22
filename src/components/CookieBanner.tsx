'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

/**
 * GDPR-compliant 4-category cookie banner. All strings come from props so
 * content lives in the CMS (see src/globals/CookieConsent.ts). Fetch the
 * global in your root layout and pass the copy + privacy-link href as
 * props:
 *
 *   const consent = await payload.findGlobal({ slug: 'cookie-consent', locale })
 *   <CookieBanner copy={{ ...consent, privacyHref: '/privacy' }} />
 *
 * Styling uses `var(--color-accent)` + `var(--color-accent-ink)` for the
 * primary "Accept all" button so the banner picks up the site's brand
 * color automatically. The rest uses `white/…` opacity values that work
 * against the fixed dark backdrop (#0E0E0F) regardless of the site theme.
 *
 * Consent state is persisted to localStorage + a cookie so the server
 * can detect "consent exists" without reading localStorage.
 */

type CategoryKey = 'necessary' | 'analytics' | 'marketing' | 'externalMedia'

export type CookieConsentCopy = {
  title: string
  body: string
  privacyLinkLabel: string
  /** Locale-aware href to the privacy page, e.g. `/de/privacy`. */
  privacyHref: string
  ctaAcceptAll: string
  ctaAcceptNecessary: string
  ctaSettings: string
  ctaLess: string
  ctaSave: string
  categories: Array<{ key: CategoryKey; label: string; description: string }>
}

// ─── Toggle ─────────────────────────────────────────────────────

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
      className={`flex items-start gap-3 text-left w-full ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group'}`}
    >
      <span
        className={`mt-0.5 shrink-0 w-10 h-[22px] rounded-full relative transition-colors duration-200 border ${
          checked
            ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
            : 'bg-white/10 border-white/25 group-hover:bg-white/20'
        }`}
      >
        <span
          className={`absolute top-[2px] w-[16px] h-[16px] rounded-full transition-transform duration-200 ${
            checked
              ? 'translate-x-[20px] bg-[var(--color-accent-ink)]'
              : 'translate-x-[2px] bg-white/90'
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="text-xs font-bold block text-white">{label}</span>
        <span className="text-[11px] text-white/60 block mt-0.5 leading-[1.45]">{description}</span>
      </span>
    </button>
  )
}

// ─── State ──────────────────────────────────────────────────────

type ConsentState = {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  externalMedia: boolean
}

const COOKIE_KEY = 'cookie-consent'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60

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
  document.cookie = `${COOKIE_KEY}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

/** Read-only accessor for other components (e.g. video embed gates). */
export function hasConsent(category: keyof ConsentState): boolean {
  const consent = getStoredConsent()
  if (!consent) return false
  return consent[category]
}

// ─── Component ──────────────────────────────────────────────────

export function CookieBanner({ copy }: { copy: CookieConsentCopy }) {
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
    if (!stored) setVisible(true)
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

  // Ensure categories render in fixed order regardless of admin-array order
  const orderedKeys: CategoryKey[] = ['necessary', 'analytics', 'marketing', 'externalMedia']
  const byKey = new Map(copy.categories.map((c) => [c.key, c]))

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-[#0E0E0F] text-white z-[99999] border-t border-white/10"
      role="dialog"
      aria-label={copy.title}
    >
      <div className="edge py-6 md:py-8">
        <div className="md:flex md:items-start md:justify-between md:gap-12">
          <div className="flex-1 max-w-[640px]">
            <p className="text-sm font-bold mb-2 text-white">{copy.title}</p>
            <p className="text-xs leading-relaxed text-white/65">
              {copy.body}{' '}
              <Link href={copy.privacyHref} className="underline hover:text-white transition-colors">
                {copy.privacyLinkLabel}
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-5 md:mt-0 md:shrink-0 md:min-w-[220px]">
            <button
              onClick={acceptAll}
              className="text-xs font-bold tracking-[0.04em] px-6 py-3 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:brightness-95 transition-[filter] uppercase"
            >
              {copy.ctaAcceptAll}
            </button>
            <button
              onClick={acceptNecessary}
              className="text-xs font-bold tracking-[0.04em] px-6 py-3 rounded-full border border-white/25 text-white/85 hover:text-white hover:border-white/60 hover:bg-white/5 transition-colors uppercase"
            >
              {copy.ctaAcceptNecessary}
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs tracking-[0.04em] px-6 py-2.5 text-white/60 hover:text-white transition-colors underline underline-offset-2"
            >
              {showDetails ? copy.ctaLess : copy.ctaSettings}
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[640px]">
              {orderedKeys.map((key) => {
                const cat = byKey.get(key)
                if (!cat) return null
                const isNecessary = key === 'necessary'
                return (
                  <ConsentToggle
                    key={key}
                    checked={isNecessary ? true : consent[key]}
                    disabled={isNecessary}
                    onChange={isNecessary ? undefined : (v) => setConsent({ ...consent, [key]: v })}
                    label={cat.label}
                    description={cat.description}
                  />
                )
              })}
            </div>

            <button
              onClick={acceptSelected}
              className="mt-5 text-xs font-bold tracking-[0.04em] px-6 py-3 rounded-full border border-white/25 text-white/85 hover:text-white hover:border-white/60 hover:bg-white/5 transition-colors uppercase"
            >
              {copy.ctaSave}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
