/**
 * The catalogue home page's parts (adr/0049 Ek 2026-11-14 §3.2 and the
 * dated note "Katalog ana sayfası"): the opening's `category_list`
 * variant (H17) and the price bands strip (`price_bands`). Their limits
 * are the contract's; the backend's schema mirrors them
 * (`lib/storefront/sections/hero.ts`, `price-bands.ts`) and a test keeps
 * them equal.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-catalog` subpath, which Turbopack resolves).
 */

/**
 * H17's own parts: the category list's rows (shown at most), the tiles
 * beside the opening's picture, the quick links under it, the products
 * shown small under its button and a pick's label.
 */
export const HERO_CATALOG_LIMITS = {
  list: { min: 4, max: 12, default: 9 },
  /** A hand-picked list's categories. */
  listed: 12,
  tiles: 2,
  chips: 4,
  picks: 4,
  pickLabel: 24,
} as const

/** Where the opening's category list comes from: the top categories, the header's menu or a pick. */
export type HeroListSource =
  { kind: "top" } | { kind: "menu" } | { kind: "manual"; category_ids: string[] }

/**
 * The price bands: 2–4 bands, each a label, an optional line and an
 * upper bound in whole units of the shop's currency (none: "and up", the
 * last band only); the products shown small in a band are picked on the
 * server, as many as `thumbs`.
 */
export const PRICE_BANDS_LIMITS = {
  bands: { min: 2, max: 4 },
  label: 30,
  text: 80,
  /** The highest upper bound a band takes, in whole units. */
  max: 10_000_000,
  thumbs: { min: 0, max: 4, default: 3 },
} as const

/** One band as the design keeps it. */
export interface PriceBand {
  label: string
  text: string | null
  /** Whole units; null: no upper bound ("and up"), the last band only. */
  max: number | null
}

/**
 * Each band's range: from one whole unit above the band before's upper
 * bound (none for the first) to its own (none for "and up"), as a
 * listing's price filter reads it (`fiyat=min-max`, both ends included,
 * whole units, either end left out). So a price on a bound is in one band
 * only, the lower one.
 */
export function bandRanges(
  bands: readonly Pick<PriceBand, "max">[]
): { min: number | null; max: number | null }[] {
  return bands.map((band, index) => {
    const before = bands[index - 1]?.max
    return { min: before === undefined || before === null ? null : before + 1, max: band.max }
  })
}

/**
 * Whether the bands rise: every upper bound above the one before, and only
 * the last without one. A design that does not is refused on saving.
 */
export function bandsRise(bands: readonly Pick<PriceBand, "max">[]): boolean {
  return bands.every((band, index) => {
    if (band.max === null) {
      return index === bands.length - 1
    }
    const before = bands[index - 1]?.max
    return before === undefined || (before !== null && band.max > before)
  })
}
