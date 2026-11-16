/**
 * The product rail's own counts by variant (adr/0049 Ek 2026-11-15, owner's
 * request): what `featured`, `compact`, `columns`, `strips` and `stage_list` show, fixed by the
 * contract rather than the shop's `limit` (which `grid` and `carousel`
 * keep). Mirrored by the backend's `SHELF_LIMITS`; a unit test keeps them
 * equal.
 *
 * Imports nothing at run time (`@qticaret/types/section-shelf`).
 */
import type { ProductSource, ShelfColumns, StoreLayoutLink } from "./layout.js"
import type { ScrollerSettings } from "./section-scroller.js"
import type { ShelfStripsSettings } from "./section-strips.js"
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
  /**
   * Each product one slanted strip (Ek 2026-11-16): two to eight, the
   * theme's `STRIPS_MOST` the upper bound; a phone scrolls past three.
   */
  strips: { counts: [2, 3, 4, 5, 6, 7, 8], default: 5 },
  /**
   * One product on a stage beside the list (Ek 2026-11-16): three to six
   * products, the stage's one counted.
   */
  stage_list: { counts: [3, 4, 5, 6], default: 4 },
} as const

/**
 * A stage list rail's own settings (adr/0049 Ek 2026-11-16), read only
 * while the rail is `stage_list`, each list's first step the default:
 * which side the stage stands on from 1024 px (`start` left, `end` right);
 * its ground, the graphite stage or the light well (the marquee's and the
 * look's names); and whether the stage follows the list (`on`: every
 * product listed, the one under the pointer or the focus taking the stage;
 * `off`: the first on the stage, the rest listed, nothing moves).
 * Mirrored by the backend's `products.ts`; a unit test keeps them equal.
 */
export const SHELF_STAGE_SETTINGS = {
  stage_side: ["start", "end"],
  stage_ground: ["stage", "well"],
  stage_follow: ["on", "off"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type ShelfStageSetting = keyof typeof SHELF_STAGE_SETTINGS
export type ShelfStageSettings = {
  [S in ShelfStageSetting]: (typeof SHELF_STAGE_SETTINGS)[S][number]
}

/** A rail switched to a stage list, and what a reader takes for a step it lacks or does not know. */
export const SHELF_STAGE_DEFAULTS: Readonly<ShelfStageSettings> = {
  stage_side: "start",
  stage_ground: "stage",
  stage_follow: "on",
}

/** The stage list's settings in the order the panel offers them. */
export const SHELF_STAGE_SETTING_NAMES = Object.keys(SHELF_STAGE_SETTINGS) as ShelfStageSetting[]

/** Every stage list setting as a reader takes it: one missing or off its list reads as its default. */
export function shelfStageOf(
  section: Partial<Record<ShelfStageSetting, unknown>>
): ShelfStageSettings {
  const settings: Partial<Record<ShelfStageSetting, string>> = {}
  for (const name of SHELF_STAGE_SETTING_NAMES) {
    const steps: readonly unknown[] = SHELF_STAGE_SETTINGS[name]
    settings[name] = steps.includes(section[name])
      ? (section[name] as string)
      : SHELF_STAGE_DEFAULTS[name]
  }
  return settings as ShelfStageSettings
}

/**
 * Cards in a row on a phone (docs/tema/bilesen-denetimi (b) 3, O8; the
 * dictionary's `columns_mobile`) for a grid rail and the related products:
 * one or two, two by default (the look before the setting). Mirrored by the
 * backend's `layout-fields.ts`; a unit test keeps them equal.
 */
export const SHELF_PHONE_COLUMNS = [1, 2] as const
export type ShelfPhoneColumns = (typeof SHELF_PHONE_COLUMNS)[number]
export const SHELF_PHONE_DEFAULT: ShelfPhoneColumns = 2

/** A grid's phone columns as a reader takes them: 1 or 2, anything else the default. */
export const shelfPhoneColumnsOf = (value: unknown): ShelfPhoneColumns =>
  value === 1 ? 1 : SHELF_PHONE_DEFAULT

/**
 * Whether a rail joins the product rails beside it in one shelf with tabs
 * (docs/tema/bilesen-denetimi (b) 2, O11; bilesen-standardi §0.2): `auto`,
 * the look before the setting, joins its neighbours; `off` stands alone.
 * A columns rail never joins (its lists already stand side by side).
 * Mirrored by the backend's `products.ts`; a unit test keeps them equal.
 */
export const SHELF_TABS = ["auto", "off"] as const
export type ShelfTabs = (typeof SHELF_TABS)[number]
export const SHELF_TABS_DEFAULT: ShelfTabs = "auto"

/** A rail's tabs setting as a reader takes it: `off`, anything else the default. */
export const shelfTabsOf = (value: unknown): ShelfTabs =>
  value === "off" ? "off" : SHELF_TABS_DEFAULT

/**
 * Whether a rail may share a tabbed shelf with its neighbours: not a
 * columns rail, not one the shop set apart. The theme joins two rails
 * standing next to each other when both may; the panel says which.
 */
export const shelfJoins = (section: { variant?: unknown; tabs?: unknown }): boolean =>
  section.variant !== "columns" && shelfTabsOf(section.tabs) === "auto"

export type ShelfRows = (typeof SHELF_LIMITS.compact.rows)[number]
export type ShelfPerList = (typeof SHELF_LIMITS.columns.per_list)[number]
export type ShelfStripsCount = (typeof SHELF_LIMITS.strips.counts)[number]
export type ShelfStageCount = (typeof SHELF_LIMITS.stage_list.counts)[number]

/** A strips rail's count as a reader takes it: one on the list as it is, anything else the default. */
export const shelfStripsCountOf = (value: unknown): ShelfStripsCount =>
  SHELF_LIMITS.strips.counts.find((each) => each === value) ?? SHELF_LIMITS.strips.default

/** A stage list's count as a reader takes it: one on the list as it is, anything else the default. */
export const shelfStageCountOf = (value: unknown): ShelfStageCount =>
  SHELF_LIMITS.stage_list.counts.find((each) => each === value) ?? SHELF_LIMITS.stage_list.default

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
  strips_count?: unknown
  stage_count?: unknown
}): number {
  switch (section.variant) {
    case "featured":
      return SHELF_LIMITS.featured
    case "compact":
      return SHELF_LIMITS.compact.across * shelfRowsOf(section.rows)
    case "columns":
      return shelfPerListOf(section.per_list)
    case "strips":
      return shelfStripsCountOf(section.strips_count)
    case "stage_list":
      return shelfStageCountOf(section.stage_count)
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
  /** Set apart from its neighbours' tabs; printed only when `off` (absent: `auto`). */
  tabs?: ShelfTabs
  /** `grid`: cards in a row on a wide screen. */
  columns?: ShelfColumns
  /** `grid`: cards in a row on a phone; printed only when not the default (2). */
  columns_mobile?: ShelfPhoneColumns
  /** `carousel`: the scroller kit's settings. */
  scroller?: ScrollerSettings
  /** `compact`: its rows. */
  rows?: ShelfRows
  /** `columns`: cards per list, and its one or two more lists. */
  per_list?: ShelfPerList
  lists?: StoreShelfList[]
  /** `strips`: how many products, one strip each; its look is `ShelfStripsSettings`' fields. */
  strips_count?: ShelfStripsCount
  strips_height?: ShelfStripsSettings["strips_height"]
  strips_slant?: ShelfStripsSettings["strips_slant"]
  strips_line?: ShelfStripsSettings["strips_line"]
  strips_overlap?: ShelfStripsSettings["strips_overlap"]
  strips_dim?: ShelfStripsSettings["strips_dim"]
  /** `stage_list`: how many products (the stage's one counted), and its side, ground and follow. */
  stage_count?: ShelfStageCount
  stage_side?: ShelfStageSettings["stage_side"]
  stage_ground?: ShelfStageSettings["stage_ground"]
  stage_follow?: ShelfStageSettings["stage_follow"]
}
