/**
 * Parses a preferred locale from Accept-Language / pref cookie.
 * Pure utility — no framework imports — so it can run in both the
 * edge middleware and server components.
 *
 * Adapt SUPPORTED / DEFAULT to your project's Payload localization config.
 */

export type Locale = 'en' | 'de'

const SUPPORTED: Locale[] = ['en', 'de']
const DEFAULT: Locale = 'en'

export function detectLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  // 1. Explicit cookie wins (set by user preference, e.g. LocaleSwitcher)
  if (cookieValue && (SUPPORTED as string[]).includes(cookieValue)) {
    return cookieValue as Locale
  }

  // 2. Accept-Language parsed: first token matching a supported prefix
  if (!acceptLanguage) return DEFAULT
  const parts = acceptLanguage
    .toLowerCase()
    .split(',')
    .map((s) => s.trim().split(';')[0])

  for (const part of parts) {
    for (const loc of SUPPORTED) {
      if (part.startsWith(loc)) return loc
    }
  }

  return DEFAULT
}
