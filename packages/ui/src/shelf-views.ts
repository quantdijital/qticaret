import type {
  ProductsVariant,
  ScrollerSettings,
  ShelfColumns,
  ShelfPerList,
  ShelfPhoneColumns,
  ShelfRows,
  ShelfTabs,
} from "@qticaret/types"
import type { ProductCardView } from "./product-views"
import type { LinkView } from "./views"

/**
 * A product rail as a theme draws it (adr/0049 Ek 2026-11-05, Ek
 * 2026-11-15): its cards and how they stand. A theme draws a variant it
 * does not have as `grid`; a view without one is a grid too.
 */
export interface ProductsSectionView {
  id: string
  type: "products"
  title: string
  products: ProductCardView[]
  more: LinkView | null
  /** Words when the rail has nothing to show. */
  empty: string
  /** How the cards stand; none: `grid`. */
  variant?: ProductsVariant
  /**
   * `off`: drawn on its own, never in its neighbours' tabbed shelf
   * (bilesen-denetimi (b) 2). None: `auto`, it joins them (`shelfJoins`).
   */
  tabs?: ShelfTabs
  /**
   * `grid`: cards in a row on a wide screen, the shop's choice (adr/0049
   * Ek 2026-11-05); the theme steps down on narrower ones. None: 3.
   */
  columns?: ShelfColumns
  /** `grid`: cards in a row on a phone (bilesen-denetimi (b) 3); none: 2. */
  phoneColumns?: ShelfPhoneColumns
  /** `carousel`: the scroller kit's settings, each a step the contract knows. */
  scroller?: ScrollerSettings
  /** `compact`: rows of three small cards (one card a row on a phone). */
  rows?: ShelfRows
  /**
   * `columns`: every list side by side, the rail's own first (its title
   * and products are the section's too), each already cut to its count.
   */
  lists?: ShelfListView[]
  /** `columns`: cards per list. */
  perList?: ShelfPerList
}

/** One list of a `columns` rail: its title (the shop's, else its source's name) and its cards. */
export interface ShelfListView {
  id: string
  title: string
  products: ProductCardView[]
}
