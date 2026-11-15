import type {
  CardVariant,
  ProductSource,
  ProductsVariant,
  ScrollerSettings,
  ShelfColumns,
  ShelfPerList,
  ShelfRows,
} from "@qticaret/types"
import type { BodySectionBase, LayoutLink } from "@/features/storefront/api/layout-sections"

// A product rail of the theme editor's document (adr/0049 Ek 2026-11-05, Ek 2026-11-15)

export interface ProductsSection extends BodySectionBase {
  type: "products"
  /** How the cards stand (adr/0049 Ek 2026-11-15); the server fills `grid` on reading. */
  variant: ProductsVariant
  /** A columns rail's first list's title. */
  title: string | null
  source: ProductSource
  /** What a grid or a carousel shows at most; the other variants' counts are fixed. */
  limit: number
  /** A "see all" link under the rail. */
  more: LayoutLink | null
  /** The rail's own card style over the theme's (adr/0049 Ek 2026-11-14 §3.3); null or absent: the theme's. */
  card_variant?: CardVariant | null
  /** `grid`: cards in a row on a wide screen; the theme steps down on narrower ones. */
  columns?: ShelfColumns
  /** `carousel`: the scroller kit's settings. */
  scroller?: ScrollerSettings
  /** `compact`: rows of three small cards. */
  rows?: ShelfRows
  /** `columns`: cards per list, and the one or two lists beside the rail's own. */
  per_list?: ShelfPerList
  lists?: ShelfList[]
}

/** One more list of a `columns` rail: its title (null: its source's name) and source. */
export interface ShelfList {
  title: string | null
  source: ProductSource
}
