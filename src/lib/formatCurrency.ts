/**
 * Format a number as currency, using the page locale to pick the right
 * thousands/decimal separators + currency symbol placement.
 *
 *   en-GB →  €1,500
 *   de-DE →  1.500 €
 *   de-CH →  CHF 1’500   (apostrophe-prime as thousands separator)
 *
 * Falls back to en-GB for any unknown short locale.
 *
 * Add new markets here. The key is the URL locale segment (`/de`, `/en`,
 * `/de-CH`); the value is the BCP-47 tag `Intl.NumberFormat` consumes.
 */

const LOCALE_MAP: Record<string, string> = {
  de: 'de-DE',
  en: 'en-GB',
  'de-CH': 'de-CH',
}

export function formatCurrency(
  value: number,
  locale: string = 'en',
  currency: string = 'EUR',
): string {
  const bcp47 = LOCALE_MAP[locale] ?? 'en-GB'
  return new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}
