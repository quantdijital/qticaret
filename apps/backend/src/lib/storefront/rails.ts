/**
 * The home page's rails the server picks (adr/0049 Ek 2026-11-05): the
 * products on sale and the best sellers. Pure: the callers read the
 * search index, the prices and the orders; this orders and tops up.
 */

/** How many of the newest products on sale are weighed for a sale rail's order. */
export const SALE_POOL = 96

/** A picked rail: its products in order, and whether the newest made up its count. */
export interface RailPick {
  product_ids: string[]
  filled_with_newest: boolean
}

/** A variant's price as the card shows it: now, and struck through when on sale. */
export interface ShownCut {
  on_sale: boolean
  current: number
  before: number | null
}

/** The share of the struck-through price a display takes off; 0 when it shows no discount. */
export function cutOf(display: ShownCut | undefined): number {
  if (!display?.on_sale || display.before === null || display.before <= display.current) {
    return 0
  }
  return (display.before - display.current) / display.before
}

/**
 * The products on sale, the deepest cut of any of their variants first.
 * Equal cuts keep the order given (the index's: the newest first); a
 * product the prices no longer show on sale (the index trails a list that
 * just ended by a minute) stays, last, as `/kampanyalar` still lists it.
 */
export function deepestFirst(
  ids: readonly string[],
  variants: readonly { id: string; product_id: string }[],
  displays: ReadonlyMap<string, ShownCut>
): string[] {
  const cuts = new Map<string, number>()
  for (const variant of variants) {
    const cut = cutOf(displays.get(variant.id))
    cuts.set(variant.product_id, Math.max(cuts.get(variant.product_id) ?? 0, cut))
  }
  return ids
    .map((id, index) => ({ id, index, cut: cuts.get(id) ?? 0 }))
    .sort((a, b) => b.cut - a.cut || a.index - b.index)
    .map(({ id }) => id)
}

/**
 * A best-seller rail of `limit`: the ranked products first; when sales
 * are too few to fill it, the newest products not among them make up the
 * rest, and the pick says so. No count is invented or shown.
 */
export function topUp(
  ranked: readonly string[],
  newest: readonly string[],
  limit: number
): RailPick {
  const picked = [...new Set(ranked)].slice(0, limit)
  const taken = new Set(picked)
  const fill = newest.filter((id) => !taken.has(id)).slice(0, limit - picked.length)
  return { product_ids: [...picked, ...fill], filled_with_newest: fill.length > 0 }
}
