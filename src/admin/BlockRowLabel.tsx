'use client'

import { useRowLabel } from '@payloadcms/ui'

/**
 * Custom row label for Block-field items in the admin panel.
 *
 * Shows a "🚫 Ausgeblendet:" prefix + reduces text opacity when the block's
 * `wrapper.hidden` field is true, so editors can see which sections are
 * switched off without opening the block accordion.
 *
 * How it's wired up:
 *   1. src/fields/wrapperFields.ts adds the `hidden` checkbox to every block
 *      that uses makeWrapperFields().
 *   2. src/blocks/index.ts wraps every Block definition via withRowLabel()
 *      which sets `admin.components.Label = '@/admin/BlockRowLabel#BlockRowLabel'`.
 *   3. After the first time you register a custom admin component, run
 *      `pnpm generate:importmap` so Payload's admin bundle can find it.
 *
 * Label fallback chain picks the most human-readable text per block type:
 *   title → line1 → name → heading → eyebrow → "#<index>".
 */
export function BlockRowLabel() {
  const { data, rowNumber } = useRowLabel<{
    blockType?: string
    title?: string
    line1?: string
    name?: string
    heading?: string
    eyebrow?: string
    wrapper?: { hidden?: boolean }
  }>()

  const hidden = data?.wrapper?.hidden === true
  const blockType = data?.blockType || 'block'
  const friendlyBlock = blockTypeLabel(blockType)
  const summary =
    data?.title ||
    data?.line1 ||
    data?.name ||
    data?.heading ||
    data?.eyebrow ||
    `#${(rowNumber ?? 0) + 1}`

  return (
    <span
      style={{
        opacity: hidden ? 0.55 : 1,
        fontStyle: hidden ? 'italic' : 'normal',
      }}
    >
      {hidden && (
        <>
          <span aria-hidden="true" style={{ marginRight: 4 }}>
            🚫
          </span>
          <strong style={{ marginRight: 6 }}>Ausgeblendet:</strong>
        </>
      )}
      <strong>{friendlyBlock}</strong>
      {' — '}
      {summary}
    </span>
  )
}

/**
 * Drop the `m<N>-` prefix and title-case the rest for readability.
 * e.g. `m3-bento-work` → `Bento Work`
 */
function blockTypeLabel(slug: string): string {
  const withoutPrefix = slug.replace(/^m\d+-/, '')
  return withoutPrefix
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
