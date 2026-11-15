import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, optional, recordId, title } from "../layout-fields"
import { storefrontLink } from "../menus"
import { bodyFields } from "./look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The linked cards' settings (adr/0049 Ek 2026-11-15): mirrors
 * `@qticaret/types`' `CATEGORY_CARD_SETTINGS`, `CATEGORY_CARD_LIMITS` and
 * `CATEGORY_CARD_DEFAULTS` (the backend reads no runtime value from that
 * package); a unit test keeps them equal.
 */
export const CATEGORY_CARD_SETTINGS = {
  columns: [2, 3, 4],
  columns_mobile: [1, 2],
  image_position: ["side", "top", "none"],
  frame: ["lined", "plain"],
} as const

export const CATEGORY_CARD_LIMITS = { links: { min: 0, max: 8, default: 5 } } as const

export const CATEGORY_CARD_DEFAULTS = {
  columns: 3,
  columns_mobile: 1,
  image_position: "side",
  frame: "lined",
  links: CATEGORY_CARD_LIMITS.links.default,
} as const

type Setting = keyof typeof CATEGORY_CARD_SETTINGS

/** A step on the setting's list; another is a stale or forged editor, as a variant off its list is. */
const step = <S extends Setting>(setting: S) =>
  z
    .custom<(typeof CATEGORY_CARD_SETTINGS)[S][number]>(
      (value) => (CATEGORY_CARD_SETTINGS[setting] as readonly unknown[]).includes(value),
      VARIANT_ERROR
    )
    .default(CATEGORY_CARD_DEFAULTS[setting])

/** What every variant has: the title, the categories named, the counts and the link beside the title. */
const common = {
  ...bodyFields,
  type: z.literal("categories"),
  title,
  /** None: the top categories. */
  category_ids: z.array(recordId).max(LAYOUT_LIMITS.items).default([]),
  /** Each card's product count (adr/0049 Ek 2026-11-14 §10 karar 7b); off as before. */
  show_count: z.boolean().default(false),
  /** The link beside the title; none: the storefront's "every category". */
  more: optional(storefrontLink),
}

/** Today's picture tiles. */
const tiles = z.object({ ...common, variant: defaultVariant("categories") }).strict()

/**
 * Each category a card: its picture beside or above the words (or none),
 * its name, its first `links` subcategories and a "see all" link; `columns`
 * cards in a row on a wide screen, framed by a hairline or plain.
 */
const linked = z
  .object({
    ...common,
    variant: z.literal("linked"),
    columns: step("columns"),
    columns_mobile: step("columns_mobile"),
    image_position: step("image_position"),
    frame: step("frame"),
    links: z
      .number()
      .int()
      .min(CATEGORY_CARD_LIMITS.links.min)
      .max(CATEGORY_CARD_LIMITS.links.max)
      .default(CATEGORY_CARD_LIMITS.links.default),
  })
  .strict()

export const CATEGORIES_BRANCHES: Readonly<Record<SectionVariant<"categories">, VariantBranch>> = {
  tiles,
  linked,
}

/** The shop's categories as cards. */
export const categories = z.discriminatedUnion("variant", [tiles, linked], VARIANT_ERROR)

export type CategoriesSection = z.infer<typeof categories>
