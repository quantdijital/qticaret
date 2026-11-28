import type {
  CardVariant,
  ProductSource,
  ProductsVariant,
  ScrollerSettings,
  ShelfColumns,
  ShelfPerList,
  ShelfPhoneColumns,
  ShelfRankedCount,
  ShelfRankedLayout,
  ShelfRows,
  ShelfStageCount,
  ShelfStageSettings,
  ShelfStripsCount,
  ShelfStripsSettings,
  ShelfTabs,
  StoreHeadLines,
} from "@qticaret/types"
import type { BodySectionBase, LayoutLink } from "@/features/storefront/api/layout-sections"

// A product rail of the theme editor's document (adr/0049 Ek 2026-11-05, Ek 2026-11-15)

export interface ProductsSection extends BodySectionBase, StoreHeadLines {
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
  /** Joined with the rails beside it in one tabbed shelf, or set apart (bilesen-denetimi (b) 2); absent: `auto`. */
  tabs?: ShelfTabs
  /** `grid`: cards in a row on a wide screen; the theme steps down on narrower ones. */
  columns?: ShelfColumns
  /** `grid`: cards in a row on a phone (bilesen-denetimi (b) 3); the server fills 2 on reading. */
  columns_mobile?: ShelfPhoneColumns
  /** `carousel`: the scroller kit's settings. */
  scroller?: ScrollerSettings
  /** `compact`: rows of three small cards. */
  rows?: ShelfRows
  /** `columns`: cards per list, and the one or two lists beside the rail's own. */
  per_list?: ShelfPerList
  lists?: ShelfList[]
  /** `strips` (Ek 2026-11-16): how many products, one strip each, and the strips' height and look. */
  strips_count?: ShelfStripsCount
  strips_height?: ShelfStripsSettings["strips_height"]
  strips_slant?: ShelfStripsSettings["strips_slant"]
  strips_line?: ShelfStripsSettings["strips_line"]
  strips_overlap?: ShelfStripsSettings["strips_overlap"]
  strips_dim?: ShelfStripsSettings["strips_dim"]
  /** `ranked` (Ek 2026-11-16): how many places, and how they stand from 1024 px. */
  ranked_count?: ShelfRankedCount
  ranked_layout?: ShelfRankedLayout
  /** `stage_list` (Ek 2026-11-16): how many products, and the stage's side, ground and follow. */
  stage_count?: ShelfStageCount
  stage_side?: ShelfStageSettings["stage_side"]
  stage_ground?: ShelfStageSettings["stage_ground"]
  stage_follow?: ShelfStageSettings["stage_follow"]
}

/** One more list of a `columns` rail: its title (null: its source's name) and source. */
export interface ShelfList {
  title: string | null
  source: ProductSource
}
