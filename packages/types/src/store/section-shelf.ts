/**
 * The product rail's own counts by variant (adr/0049 Ek 2026-11-15, owner's
 * request): what `featured`, `compact` and `columns` show, fixed by the
 * contract rather than the shop's `limit` (which `grid` and `carousel`
 * keep). Mirrored by the backend's `SHELF_LIMITS`; a unit test keeps them
 * equal.
 *
 * Imports nothing at run time (`@qticaret/types/section-shelf`).
 */
import type { ProductSource, ShelfColumns, StoreLayoutLink } from "./layout.js"
import type { ScrollerSettings } from "./section-scroller.js"
import type { CardVariant, ProductsVariant } from "./section-variants.js"

export const SHELF_LIMITS = {
  /** One large card and two rows of three small ones beside it. */
  featured: 7,
  /** Small cards three across, two or three rows. */
  compact: { across: 3, rows: [2, 3], default: 2 },
  /**
   * Two or three lists side by side: the rail's own (its title and source)
   * and one or two more, each three or four small cards.
   */
  columns: { lists: { min: 1, max: 2 }, per_list: [3, 4], default: 4 },
} as const

export type ShelfRows = (typeof SHELF_LIMITS.compact.rows)[number]
export type ShelfPerList = (typeof SHELF_LIMITS.columns.per_list)[number]

/** A compact rail's rows as a reader takes them: 2 or 3, anything else the default. */
export const shelfRowsOf = (value: unknown): ShelfRows =>
  value === 3 ? 3 : SHELF_LIMITS.compact.default

/** A columns rail's cards per list as a reader takes them: 3 or 4, anything else the default. */
export const shelfPerListOf = (value: unknown): ShelfPerList =>
  value === 3 ? 3 : SHELF_LIMITS.columns.default

/**
 * How many products a rail of each variant asks its source for: the shop's
 * `limit` on a grid or a carousel, the variant's own count on the others
 * (a columns rail's per list).
 */
export function shelfLimit(section: {
  variant?: unknown
  limit: number
  rows?: unknown
  per_list?: unknown
}): number {
  switch (section.variant) {
    case "featured":
      return SHELF_LIMITS.featured
    case "compact":
      return SHELF_LIMITS.compact.across * shelfRowsOf(section.rows)
    case "columns":
      return shelfPerListOf(section.per_list)
    default:
      return section.limit
  }
}

/** A sale or best-seller list's products, picked by the backend in order; absent for the other sources. */
export interface ShelfPick {
  product_ids?: string[]
  /** A best-seller list with too few sales, its rest the newest products; no counts shown. */
  filled_with_newest?: boolean
}

/** One more list of a `columns` rail: its own title (null: named by its source) and source. */
export interface StoreShelfList extends ShelfPick {
  title: string | null
  source: ProductSource
}

/**
 * A product rail as the backend gives it. Each variant's own fields are
 * present with that variant only; a backend before variants sends none
 * and `columns` (read as `grid`).
 */
export interface StoreProductsSection extends ShelfPick {
  id: string
  type: "products"
  /** Absent from a backend before variants; one this build does not know reads as `grid`. */
  variant?: ProductsVariant
  /** A columns rail's first list's title. */
  title: string | null
  source: ProductSource
  /** What a grid or a carousel shows at most; the other variants' counts are `SHELF_LIMITS`'. */
  limit: number
  more: StoreLayoutLink | null
  /** The rail's own card variant; null or absent (an older backend): the theme setting's. */
  card_variant?: CardVariant | null
  /** `grid`: cards in a row on a wide screen. */
  columns?: ShelfColumns
  /** `carousel`: the scroller kit's settings. */
  scroller?: ScrollerSettings
  /** `compact`: its rows. */
  rows?: ShelfRows
  /** `columns`: cards per list, and its one or two more lists. */
  per_list?: ShelfPerList
  lists?: StoreShelfList[]
}
