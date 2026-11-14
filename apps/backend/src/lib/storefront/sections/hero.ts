import { z } from "@medusajs/framework/zod"
import { image, optional, recordId, shopText, text } from "../layout-fields"
import { bodyFields } from "./look"
import { storefrontLink } from "../menus"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The page's opening: a line above, a heading, a text, up to two buttons
 * and a picture, in every variant (adr/0049 Ek 2026-11-14 §2, option B).
 * `standard` is today's graphite stage; `category_list` (H17, §3.2) sets
 * the same opening as a tile between the shop's category list (with
 * product counts) and two category tiles, with quick links under it.
 *
 * Mirrors `@qticaret/types`' `HERO_CATALOG_LIMITS` (the backend reads no
 * runtime value from that package); a unit test keeps them equal.
 */
export const HERO_CATALOG_LIMITS = {
  list: { min: 4, max: 12, default: 9 },
  listed: 12,
  tiles: 2,
  chips: 4,
  picks: 4,
  pickLabel: 24,
} as const

const L = HERO_CATALOG_LIMITS

const common = {
  ...bodyFields,
  type: z.literal("hero"),
  eyebrow: optional(shopText(40)),
  /** None: the shop's name. */
  heading: optional(shopText(90)),
  text: optional(shopText(240)),
  links: z.array(storefrontLink).max(2).default([]),
  image: optional(image),
}

/** Today's opening: one graphite stage, the picture beside the words. */
const standard = z.object({ ...common, variant: defaultVariant("hero") }).strict()

/** Where the list's categories come from: the top ones, the header's menu, or the shop's pick. */
const listSource = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("top") }).strict(),
    z.object({ kind: z.literal("menu") }).strict(),
    z
      .object({ kind: z.literal("manual"), category_ids: z.array(recordId).min(1).max(L.listed) })
      .strict(),
  ],
  VARIANT_ERROR
)

/**
 * H17: the list (its rows at most `list_limit`, each with its count when
 * `show_count`), the opening as the middle tile (its products shown small
 * under the button, the lowest of their live prices "from" when
 * `show_price`), up to two category tiles beside it (the shop's picture,
 * else the category's) and up to four quick links under it.
 */
const categoryList = z
  .object({
    ...common,
    variant: z.literal("category_list"),
    list: listSource.default({ kind: "top" }),
    list_limit: z.number().int().min(L.list.min).max(L.list.max).default(L.list.default),
    show_count: z.boolean().default(true),
    tiles: z
      .array(z.object({ category_id: recordId, image: optional(image) }).strict())
      .max(L.tiles)
      .default([]),
    chips: z.array(storefrontLink).max(L.chips).default([]),
    picks: z
      .array(z.object({ product_id: recordId, label: optional(text(L.pickLabel)) }).strict())
      .max(L.picks)
      .default([]),
    show_price: z.boolean().default(true),
  })
  .strict()

export const HERO_BRANCHES: Readonly<Record<SectionVariant<"hero">, VariantBranch>> = {
  standard,
  category_list: categoryList,
}

export const hero = z.discriminatedUnion("variant", [standard, categoryList], VARIANT_ERROR)

export type HeroSection = z.infer<typeof hero>
export type HeroCatalogSection = Extract<HeroSection, { variant: "category_list" }>
