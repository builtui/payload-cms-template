/**
 * Slugify — converts any string to a URL-safe slug.
 *
 * - Transliterates German umlauts (ä → ae, ö → oe, ü → ue, ß → ss)
 * - Lowercases everything
 * - Replaces spaces and special characters with hyphens
 * - Collapses multiple hyphens
 * - Trims leading/trailing hyphens
 *
 * Examples:
 *   "Zwischenräume" → "zwischenraeume"
 *   "Das schöne Haus!" → "das-schoene-haus"
 *   "Künstler:innen-Übersicht" → "kuenstler-innen-uebersicht"
 */

const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  Ä: 'Ae', Ö: 'Oe', Ü: 'Ue',
  à: 'a', á: 'a', â: 'a', ã: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u',
  ñ: 'n', ç: 'c',
}

export function slugify(input: string): string {
  if (!input) return ''

  return input
    // Replace umlauts and accented characters
    .replace(/[äöüßÄÖÜàáâãåèéêëìíîïòóôõùúûñçÁÀÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÑÇ]/g, (char) => UMLAUT_MAP[char] || char)
    // Lowercase
    .toLowerCase()
    // Replace anything that's not a-z, 0-9, or hyphen with a hyphen
    .replace(/[^a-z0-9]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Trim leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
}
