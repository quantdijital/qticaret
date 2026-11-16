import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, columns, columnsMobile, optional, recordId, title } from "../layout-fields"
import { bodyFields } from "./look"
import { storefrontLink } from "../menus"
import { scroller } from "./scroller"
import { collectionSource, manualSource } from "./sources"
import {
  STRIPS_HEIGHTS,
  STRIPS_LOOK_DEFAULTS,
  STRIPS_LOOK_SETTINGS,
  stepSetting,
} from "./strips-look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"
import { PRODUCT_CARD_VARIANTS } from "../../../modules/platform-settings/sections/theme"

/** A best-seller rail's window in days (adr/0049 Ek 2026-11-05): a week to a year, a season by default. */
export const BEST_SELLER_DAYS = { min: 7, max: 365, default: 90 } as const

/**
 * The rail's counts by variant (adr/0049 Ek 2026-11-15). Mirrors
 * `@qticaret/types`' `SHELF_LIMITS`; a unit test keeps them equal.
 */
export const SHELF_LIMITS = {
  featured: 7,
  compact: { across: 3, rows: [2, 3], default: 2 },
  columns: { lists: { min: 1, max: 2 }, per_list: [3, 4], default: 4 },
  strips: { counts: [2, 3, 4, 5, 6, 7, 8], default: 5 },
  ranked: { counts: [3, 4, 5, 6, 7, 8, 9, 10], default: 5 },
  stage_list: { counts: [3, 4, 5, 6], default: 4 },
} as const

/**
 * How a ranked rail stands from 1024 px (adr/0049 Ek 2026-11-16): the
 * first large beside the rest, or all in one row. Mirrors `@qticaret/types`'
 * `SHELF_RANKED_LAYOUTS` and its default; a unit test keeps them equal.
 */
export const SHELF_RANKED_LAYOUTS = ["lead", "row"] as const
export const SHELF_RANKED_LAYOUT_DEFAULT: (typeof SHELF_RANKED_LAYOUTS)[number] = "lead"

/**
 * A stage list rail's own settings (adr/0049 Ek 2026-11-16): the stage's
 * side, its ground and whether it follows the list, each list's first the
 * default. Mirrors `@qticaret/types`' `SHELF_STAGE_SETTINGS` and
 * `SHELF_STAGE_DEFAULTS`; a unit test keeps them equal.
 */
export const SHELF_STAGE_SETTINGS = {
  stage_side: ["start", "end"],
  stage_ground: ["stage", "well"],
  stage_follow: ["on", "off"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type StageSetting = keyof typeof SHELF_STAGE_SETTINGS

export const SHELF_STAGE_DEFAULTS: {
  readonly [S in StageSetting]: (typeof SHELF_STAGE_SETTINGS)[S][number]
} = { stage_side: "start", stage_ground: "stage", stage_follow: "on" }

const stageSetting = <S extends StageSetting>(name: S) =>
  stepSetting<(typeof SHELF_STAGE_SETTINGS)[S][number]>(
    SHELF_STAGE_SETTINGS[name],
    SHELF_STAGE_DEFAULTS[name]
  )

/**
 * A strips rail's own settings (adr/0049 Ek 2026-11-16): the strips'
 * height and the look every strips drawing shares. Mirrors
 * `@qticaret/types`' `SHELF_STRIPS_SETTINGS` and `SHELF_STRIPS_DEFAULTS`;
 * a unit test keeps them equal.
 */
export const SHELF_STRIPS_SETTINGS = {
  strips_height: STRIPS_HEIGHTS,
  ...STRIPS_LOOK_SETTINGS,
} as const satisfies Record<string, readonly [string, ...string[]]>

type StripsSetting = keyof typeof SHELF_STRIPS_SETTINGS

export const SHELF_STRIPS_DEFAULTS: {
  readonly [S in StripsSetting]: (typeof SHELF_STRIPS_SETTINGS)[S][number]
} = {
  strips_height: "low",
  ...STRIPS_LOOK_DEFAULTS,
}

const stripsSetting = <S extends StripsSetting>(name: S) =>
  stepSetting<(typeof SHELF_STRIPS_SETTINGS)[S][number]>(
    SHELF_STRIPS_SETTINGS[name],
    SHELF_STRIPS_DEFAULTS[name]
  )

export const productSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("newest") }).strict(),
  /** What `/kampanyalar` lists now, the deepest discount first; picked on the server. */
  z.object({ kind: z.literal("on_sale") }).strict(),
  /** The most units sold in paid orders over the last `days`; picked on the server. */
  z
    .object({
      kind: z.literal("best_sellers"),
      days: z
        .number()
        .int()
        .min(BEST_SELLER_DAYS.min)
        .max(BEST_SELLER_DAYS.max)
        .default(BEST_SELLER_DAYS.default),
    })
    .strict(),
  z.object({ kind: z.literal("category"), category_id: recordId }).strict(),
  collectionSource,
  manualSource(LAYOUT_LIMITS.items),
])

export type ProductSourceInput = z.infer<typeof productSource>

/**
 * Whether the rail joins the rails beside it in one tabbed shelf
 * (bilesen-denetimi (b) 2): `auto`, as before the setting, or `off`.
 * Mirrors `@qticaret/types`' `SHELF_TABS`; a unit test keeps them equal.
 */
export const SHELF_TABS = ["auto", "off"] as const
export const SHELF_TABS_DEFAULT = "auto" satisfies (typeof SHELF_TABS)[number]

/** Two or three of a closed list of counts, refused with the error key off it. */
const count = <N extends number>(steps: readonly N[], fallback: N) =>
  z
    .custom<N>((value) => (steps as readonly unknown[]).includes(value), VARIANT_ERROR)
    .default(fallback)

/** What every variant of the rail holds, under the same names (switching keeps them). */
const common = {
  ...bodyFields,
  type: z.literal("products"),
  /** A columns rail's first list's title. */
  title,
  source: productSource,
  /** What a grid or a carousel shows at most; the other variants' counts are `SHELF_LIMITS`'. */
  limit: z.number().int().min(1).max(LAYOUT_LIMITS.items).default(12),
  /** A "see all" link under the rail. */
  more: optional(storefrontLink),
  /**
   * The rail's own card variant over the theme setting's (adr/0049 Ek
   * 2026-11-14 §3.3, owner's decision 4); null: the setting's. Only the
   * variant: the framed card's E5 fields are the theme setting's everywhere.
   */
  card_variant: optional(z.enum(PRODUCT_CARD_VARIANTS, VARIANT_ERROR)),
  /**
   * Joined with the rails beside it in one tabbed shelf, or set apart;
   * kept on every variant so switching keeps it (a columns rail never joins).
   */
  tabs: z
    .custom<(typeof SHELF_TABS)[number]>(
      (value) => (SHELF_TABS as readonly unknown[]).includes(value),
      VARIANT_ERROR
    )
    .default(SHELF_TABS_DEFAULT),
}

/** Today's rows of cards; the shop's cards in a row on a wide screen (adr/0049 Ek 2026-11-05). */
const grid = z
  .object({
    ...common,
    variant: defaultVariant("products"),
    columns,
    columns_mobile: columnsMobile,
  })
  .strict()

/** One row that slides sideways, driven by the scroller kit. */
const carousel = z.object({ ...common, variant: z.literal("carousel"), scroller }).strict()

/** One large card (the first product) beside two rows of three small ones. */
const featured = z.object({ ...common, variant: z.literal("featured") }).strict()

/** Small side-by-side cards three across, two or three rows. */
const compact = z
  .object({
    ...common,
    variant: z.literal("compact"),
    rows: count(SHELF_LIMITS.compact.rows, SHELF_LIMITS.compact.default),
  })
  .strict()

/** One more list beside a columns rail's own: its title (null: its source's name) and source. */
const shelfList = z.object({ title, source: productSource }).strict()

/** Two or three lists side by side: the rail's own (title, source) and one or two more. */
const columnsBranch = z
  .object({
    ...common,
    variant: z.literal("columns"),
    per_list: count(SHELF_LIMITS.columns.per_list, SHELF_LIMITS.columns.default),
    lists: z
      .array(shelfList)
      .min(SHELF_LIMITS.columns.lists.min)
      .max(SHELF_LIMITS.columns.lists.max),
  })
  .strict()

/**
 * Each product one slanted strip, its name and price over the foot (Ek
 * 2026-11-16): how many, how high, and the shared look.
 */
const strips = z
  .object({
    ...common,
    variant: z.literal("strips"),
    strips_count: count(SHELF_LIMITS.strips.counts, SHELF_LIMITS.strips.default),
    strips_height: stripsSetting("strips_height"),
    strips_slant: stripsSetting("strips_slant"),
    strips_line: stripsSetting("strips_line"),
    strips_overlap: stripsSetting("strips_overlap"),
    strips_dim: stripsSetting("strips_dim"),
  })
  .strict()

/**
 * A ranked list, each product beside its place in large figures (Ek
 * 2026-11-16): how many, and how they stand from 1024 px.
 */
const ranked = z
  .object({
    ...common,
    variant: z.literal("ranked"),
    ranked_count: count(SHELF_LIMITS.ranked.counts, SHELF_LIMITS.ranked.default),
    ranked_layout: stepSetting(SHELF_RANKED_LAYOUTS, SHELF_RANKED_LAYOUT_DEFAULT),
  })
  .strict()

/**
 * One product large on a stage beside a list of the rail's (Ek
 * 2026-11-16): how many, the stage's side and ground, and whether the
 * stage follows the list.
 */
const stageList = z
  .object({
    ...common,
    variant: z.literal("stage_list"),
    stage_count: count(SHELF_LIMITS.stage_list.counts, SHELF_LIMITS.stage_list.default),
    stage_side: stageSetting("stage_side"),
    stage_ground: stageSetting("stage_ground"),
    stage_follow: stageSetting("stage_follow"),
  })
  .strict()

export const PRODUCTS_BRANCHES: Readonly<Record<SectionVariant<"products">, VariantBranch>> = {
  grid,
  carousel,
  featured,
  compact,
  columns: columnsBranch,
  strips,
  ranked,
  stage_list: stageList,
}

/** A product rail (adr/0049 Ek 2026-11-15): a branch per variant. */
export const products = z.discriminatedUnion(
  "variant",
  [grid, carousel, featured, compact, columnsBranch, strips, ranked, stageList],
  VARIANT_ERROR
)

export type ProductsSection = z.infer<typeof products>

/** How many products a rail asks each of its sources for (`@qticaret/types`' `shelfLimit`). */
export function shelfLimit(section: ProductsSection): number {
  switch (section.variant) {
    case "featured":
      return SHELF_LIMITS.featured
    case "compact":
      return SHELF_LIMITS.compact.across * section.rows
    case "columns":
      return section.per_list
    case "strips":
      return section.strips_count
    case "ranked":
      return section.ranked_count
    case "stage_list":
      return section.stage_count
    case "grid":
    case "carousel":
      return section.limit
  }
}

/** Every source a rail takes products from, with its picks' key: its own, then a columns rail's lists. */
export function shelfSources(
  section: ProductsSection
): { key: string; source: ProductSourceInput }[] {
  const lists = section.variant === "columns" ? section.lists : []
  return [
    { key: section.id, source: section.source },
    ...lists.map((list, index) => ({ key: listKey(section.id, index), source: list.source })),
  ]
}

/** A columns rail's extra list's key among the picks: the section's id and its place. */
export const listKey = (sectionId: string, index: number) => `${sectionId}:${String(index + 1)}`

/**
 * A stored product rail's (or related products') card variant as today's list reads it (adr/0049
 * Ek 2026-11-14 §2.3, forgiving on reading): one off the list (taken off
 * since, or a newer build's) is the theme setting's (null). A save is
 * still held to the list.
 */
export function storedCardVariant(section: Record<string, unknown>): Record<string, unknown> {
  const listed: readonly unknown[] = PRODUCT_CARD_VARIANTS
  const variant = section["card_variant"]
  return (section["type"] !== "products" && section["type"] !== "related_products") ||
    variant === undefined ||
    variant === null ||
    listed.includes(variant)
    ? section
    : { ...section, card_variant: null }
}
