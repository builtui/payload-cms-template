import type { GlobalConfig } from 'payload'

/**
 * Editable copy for the cookie-consent banner — GDPR-compliant 4-category
 * model (necessary / analytics / marketing / external-media).
 *
 * All user-visible strings live here so editors can tweak wording without
 * a code deploy. The four category KEYS are fixed (they map to
 * localStorage entries + the consent event on window) — only the labels
 * + descriptions are localised.
 *
 * Frontend lives in `src/components/CookieBanner.tsx` which expects a
 * CookieConsentCopy prop; fetch this global in your root layout and pass
 * it in (see README snippet).
 */
export const CookieConsent: GlobalConfig = {
  slug: 'cookie-consent',
  label: 'Cookie-Banner',
  admin: { group: 'Einstellungen' },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Banner-Text',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              localized: true,
              defaultValue: 'Diese Website verwendet Cookies',
            },
            {
              name: 'body',
              type: 'textarea',
              required: true,
              localized: true,
              defaultValue:
                'Wir nutzen Cookies und ähnliche Technologien, um die Funktionalität der Website sicherzustellen und Ihnen ein optimales Erlebnis zu bieten.',
            },
            {
              name: 'privacyLinkLabel',
              type: 'text',
              required: true,
              localized: true,
              defaultValue: 'Datenschutzerklärung',
            },
          ],
        },
        {
          label: 'Buttons',
          fields: [
            { name: 'ctaAcceptAll', type: 'text', required: true, localized: true, defaultValue: 'Alle akzeptieren' },
            { name: 'ctaAcceptNecessary', type: 'text', required: true, localized: true, defaultValue: 'Nur notwendige' },
            { name: 'ctaSettings', type: 'text', required: true, localized: true, defaultValue: 'Einstellungen' },
            { name: 'ctaLess', type: 'text', required: true, localized: true, defaultValue: 'Weniger anzeigen' },
            { name: 'ctaSave', type: 'text', required: true, localized: true, defaultValue: 'Auswahl speichern' },
          ],
        },
        {
          label: 'Kategorien',
          description:
            'Die vier Kategorien sind fix definiert — Label + Beschreibung sind lokalisierbar.',
          fields: [
            {
              name: 'categories',
              type: 'array',
              maxRows: 4,
              minRows: 4,
              admin: {
                description:
                  'Reihenfolge: Notwendig, Statistik, Marketing, Externe Medien. Nicht löschen, nur Texte bearbeiten.',
              },
              fields: [
                {
                  name: 'key',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Notwendig (immer an)', value: 'necessary' },
                    { label: 'Statistik', value: 'analytics' },
                    { label: 'Marketing', value: 'marketing' },
                    { label: 'Externe Medien', value: 'externalMedia' },
                  ],
                },
                { name: 'label', type: 'text', required: true, localized: true },
                { name: 'description', type: 'textarea', required: true, localized: true },
              ],
            },
          ],
        },
      ],
    },
  ],
}
