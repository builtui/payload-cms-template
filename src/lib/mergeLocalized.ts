/**
 * Payload-localized-array merge helpers.
 *
 * ──────────────────────────────────────────────────────────────────
 * THE PROBLEM
 * ──────────────────────────────────────────────────────────────────
 * Payload's Postgres adapter stores array items (`layout[]`, `items[]`,
 * `features[]`, `specs[]` etc.) as rows in discriminator tables, each row
 * keyed by an auto-generated `id`. Localized sub-fields live in sibling
 * `_locales` tables keyed on `(_locale, _parent_id)`.
 *
 * When you run
 *
 *     p.update({ collection, id, locale: 'de', data: { layout: [...] } })
 *
 * with a layout array that doesn't carry the existing item IDs, Payload
 * assumes you're replacing the whole array. It generates fresh IDs, drops
 * the old rows, and the EN-locale data stored against the old IDs goes
 * away with them.
 *
 * Symptom: after seeding DE over EN, the EN columns in *_locales show
 * NULL for every formerly-filled field. `fallback: true` hides the damage
 * (frontend shows DE on EN routes) until someone looks in the DB.
 *
 * ──────────────────────────────────────────────────────────────────
 * THE FIX
 * ──────────────────────────────────────────────────────────────────
 * Read the existing doc (default locale), merge the locale-specific
 * overrides on top while preserving every item's `id`, then update.
 * Payload matches the items by ID on write → EN rows keep their data,
 * only the *_locales rows for the new locale get written.
 *
 * The helpers are recursive so they also handle nested arrays of
 * objects (e.g. `phases[].features[]`, `tiers[].video.specs[]`).
 *
 * ──────────────────────────────────────────────────────────────────
 * USAGE
 * ──────────────────────────────────────────────────────────────────
 *
 *     const existing = await p.findByID({ collection: 'pages', id, locale: 'en', depth: 0 })
 *     const mergedLayout = mergeLayout(existing.layout, deLayoutOverrides)
 *     await p.update({
 *       collection: 'pages', id,
 *       locale: 'de',
 *       data: { title: deTitle, layout: mergedLayout },
 *     })
 *
 * `deLayoutOverrides` only needs to contain the localized strings — not
 * the full block shape. Non-localized fields (positions, slugs, IDs,
 * media references) come from `existing` and stay untouched.
 */

/**
 * Per-index merge that preserves each item's `id`.
 * Recurses into nested arrays-of-objects so deeply-localized shapes
 * (phases[].features[], tiers[].video.specs[]) also stay ID-stable.
 */
export function mergeItems<T extends { id?: string }>(
  existing: T[] | undefined,
  overrides: Array<Partial<T>> | undefined,
): T[] {
  if (!existing) return []
  return existing.map((existingItem, i) => {
    const override = (overrides?.[i] ?? {}) as any
    const result: any = { ...existingItem, ...override, id: (existingItem as any).id }

    // Recurse into nested arrays of objects
    for (const key of Object.keys(result)) {
      const ev = (existingItem as any)?.[key]
      const ov = override[key]
      if (Array.isArray(ev) && Array.isArray(ov) && ev.length > 0 && typeof ev[0] === 'object' && ev[0] !== null) {
        result[key] = mergeItems(ev, ov)
      }
    }
    return result as T
  })
}

/**
 * Merge a single block: keep the block's `id`, override top-level fields
 * with the DE version, merge nested arrays recursively, merge nested
 * objects (like `wrapper`, `link`, `sectionHeader`) via spread.
 */
export function mergeBlock(existing: any, overrides: any): any {
  if (!existing) return overrides
  const merged: any = { ...existing, ...(overrides || {}), id: existing.id }

  for (const key of Object.keys(merged)) {
    const existingVal = existing[key]
    const overrideVal = overrides?.[key]

    if (Array.isArray(existingVal) && Array.isArray(overrideVal)) {
      if (existingVal.length > 0 && typeof existingVal[0] === 'object' && existingVal[0] !== null) {
        merged[key] = mergeItems(existingVal, overrideVal)
      } else {
        merged[key] = overrideVal
      }
    } else if (
      existingVal &&
      typeof existingVal === 'object' &&
      !Array.isArray(existingVal) &&
      overrideVal &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal)
    ) {
      merged[key] = { ...existingVal, ...overrideVal, ...(existingVal.id ? { id: existingVal.id } : {}) }
    }
  }
  return merged
}

/**
 * Merge a complete `layout` array (blocks).
 * Primary match: by index when `blockType` agrees.
 * Defensive fallback: if blockTypes diverged (editor reshuffled blocks),
 * search the remaining overrides for a matching type; if none, keep
 * the existing block unchanged.
 */
export function mergeLayout(
  existingLayout: any[] | undefined,
  overrideLayout: any[] | undefined,
): any[] {
  if (!existingLayout || existingLayout.length === 0) return []
  if (!overrideLayout || overrideLayout.length === 0) return existingLayout

  const usedIndices = new Set<number>()
  return existingLayout.map((existingBlock, i) => {
    // Prefer same-index match
    if (overrideLayout[i]?.blockType === existingBlock.blockType) {
      usedIndices.add(i)
      return mergeBlock(existingBlock, overrideLayout[i])
    }
    // Fallback: find next unused override of the same blockType
    const fallbackIdx = overrideLayout.findIndex(
      (b, idx) => !usedIndices.has(idx) && b?.blockType === existingBlock.blockType,
    )
    if (fallbackIdx >= 0) {
      usedIndices.add(fallbackIdx)
      return mergeBlock(existingBlock, overrideLayout[fallbackIdx])
    }
    return existingBlock
  })
}
