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

/**
 * The collage's settings: mirrors `@qticaret/types`' `CATEGORY_COLLAGE_SETTINGS`
 * and `CATEGORY_COLLAGE_DEFAULTS`, its columns the cards' own lists.
 */
export const CATEGORY_COLLAGE_SETTINGS = {
  columns: CATEGORY_CARD_SETTINGS.columns,
  columns_mobile: CATEGORY_CARD_SETTINGS.columns_mobile,
  height: ["low", "medium", "high"],
  lead: ["off", "on"],
} as const

export const CATEGORY_COLLAGE_DEFAULTS = {
  columns: 4,
  columns_mobile: 1,
  height: "medium",
  lead: "on",
  links: 4,
} as const

type Lists = Readonly<Record<string, readonly (string | number)[]>>

/** A step on the setting's list; another is a stale or forged editor, as a variant off its list is. */
const stepOn =
  <L extends Lists>(lists: L, defaults: { readonly [K in keyof L]: L[K][number] }) =>
  <S extends keyof L & string>(setting: S) =>
    z
      .custom<L[S][number]>(
        (value) => (lists[setting] as readonly unknown[]).includes(value),
        VARIANT_ERROR
      )
      .default(defaults[setting])

const step = stepOn(CATEGORY_CARD_SETTINGS, CATEGORY_CARD_DEFAULTS)
const collageStep = stepOn(CATEGORY_COLLAGE_SETTINGS, CATEGORY_COLLAGE_DEFAULTS)

/** Subcategory links under each card's name, the variant's own default. */
const links = (fallback: number) =>
  z
    .number()
    .int()
    .min(CATEGORY_CARD_LIMITS.links.min)
    .max(CATEGORY_CARD_LIMITS.links.max)
    .default(fallback)

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
    links: links(CATEGORY_CARD_LIMITS.links.default),
  })
  .strict()

/**
 * Each category a card led by its photograph, its name, count and first
 * `links` subcategories under it; rows filled edge to edge, at most
 * `columns` cards in one, the first twice as wide while `lead` is on.
 */
const collage = z
  .object({
    ...common,
    variant: z.literal("collage"),
    columns: collageStep("columns"),
    columns_mobile: collageStep("columns_mobile"),
    height: collageStep("height"),
    lead: collageStep("lead"),
    links: links(CATEGORY_COLLAGE_DEFAULTS.links),
  })
  .strict()

export const CATEGORIES_BRANCHES: Readonly<Record<SectionVariant<"categories">, VariantBranch>> = {
  tiles,
  linked,
  collage,
}

/** The shop's categories as cards. */
export const categories = z.discriminatedUnion("variant", [tiles, linked, collage], VARIANT_ERROR)

export type CategoriesSection = z.infer<typeof categories>
