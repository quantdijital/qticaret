/**
 * The catalogue home page's parts (adr/0049 Ek 2026-11-14 §3.2 and the
 * dated note "Katalog ana sayfası"): the opening's `category_list`
 * variant (H17) and the price bands strip (`price_bands`), and their
 * shapes in `GET /store/storefront-layout`. Their limits
 * are the contract's; the backend's schema mirrors them
 * (`lib/storefront/sections/hero.ts`, `price-bands.ts`) and a test keeps
 * them equal.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-catalog` subpath, which Turbopack resolves).
 */

import type { StoreLayoutImage, StoreLayoutLink } from "./layout.js"

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
  /** Strips a page (the home page) shows at most. */
  perPage: 2,
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

/**
 * The opening (adr/0049): a line above, a heading, a text, up to two
 * buttons and a picture; drawn as today's graphite stage (`standard`, and
 * absent from a backend before variants) or, as `category_list` (H17,
 * adr/0049 Ek 2026-11-14 §3.2), beside the shop's category list and two
 * category tiles, with quick links under it. A reader takes a variant it
 * does not know as `standard` and leaves the other's fields unread.
 */
export type StoreHeroSection = {
  id: string
  type: "hero"
  eyebrow: string | null
  /** None: the shop's name. */
  heading: string | null
  text: string | null
  links: StoreLayoutLink[]
  image: StoreLayoutImage | null
} & ({ variant?: "standard" } | StoreHeroCatalog)

/** H17's own fields; the categories' names, pictures and counts are the storefront's to fetch. */
export interface StoreHeroCatalog {
  variant: "category_list"
  list: HeroListSource
  /** Rows the list shows at most. */
  list_limit: number
  /** Each row's and tile's product count. */
  show_count: boolean
  /** The tiles beside the opening: a category, and the shop's picture for it (none: the category's). */
  tiles: { category_id: string; image: StoreLayoutImage | null }[]
  /** Quick links under the opening; a broken one left out. */
  chips: StoreLayoutLink[]
  /** Products shown small under the button, each with the shop's short label (none: its title). */
  picks: { product_id: string; label: string | null }[]
  /** The lowest price among the picks, "from", worked out from their live prices. */
  show_price: boolean
}

/**
 * The price bands strip (adr/0049 Ek 2026-11-14, note "Katalog ana
 * sayfası"): each band's words, its range in whole units of the shop's
 * currency (from just above the band before's bound to its own, `bandRanges`; null: open) and the
 * products shown small in it, picked on the server for the shopper's sales
 * channels by their indexed prices. The storefront links each band to the
 * whole catalogue's listing filtered by its range and fetches the products.
 */
export interface StorePriceBandsSection {
  id: string
  type: "price_bands"
  title: string | null
  bands: {
    label: string
    text: string | null
    min: number | null
    max: number | null
    product_ids: string[]
  }[]
}

/** `GET /store/category-counts`: each shown category's products, its shown subcategories' included. */
export interface StoreCategoryCounts {
  counts: Record<string, number>
}
