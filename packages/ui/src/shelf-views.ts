import type {
  ProductsVariant,
  ScrollerSettings,
  ShelfColumns,
  ShelfPerList,
  ShelfPhoneColumns,
  ShelfRankedLayout,
  ShelfRows,
  ShelfStageSettings,
  ShelfStripsSettings,
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
  /**
   * `strips` (Ek 2026-11-16): each product one slanted strip, its name and
   * price over the foot, no card actions; `products` already cut to the
   * rail's count. The strips' height and look, each a step the contract knows.
   */
  strips?: ShelfStripsSettings
  /**
   * `ranked` (Ek 2026-11-16): how the ranked list stands from 1024 px, a
   * step the contract knows; `products` in their order, already cut to
   * the rail's count, each beside its place.
   */
  rankedLayout?: ShelfRankedLayout
  /**
   * `stage_list` (Ek 2026-11-16): one product large on a stage beside a
   * list; `products` already cut to the rail's count, the stage's first.
   * Its side, ground and follow, each a step the contract knows.
   */
  stage?: ShelfStageSettings
}

/** One list of a `columns` rail: its title (the shop's, else its source's name) and its cards. */
export interface ShelfListView {
  id: string
  title: string
  products: ProductCardView[]
  /**
   * Its place in the design (0 the rail's own, 1 its first more list) when
   * one before it had nothing to show and was left out, for the editor's
   * field mark; absent: its drawn place.
   */
  at?: number
}
