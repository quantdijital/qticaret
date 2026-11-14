import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, columns, optional, recordId, title } from "../layout-fields"
import { bodyFields } from "./look"
import { storefrontLink } from "../menus"
import { collectionSource, manualSource } from "./sources"
import { VARIANT_ERROR } from "./variants"
import { PRODUCT_CARD_VARIANTS } from "../../../modules/platform-settings/sections/theme"

/** A best-seller rail's window in days (adr/0049 Ek 2026-11-05): a week to a year, a season by default. */
export const BEST_SELLER_DAYS = { min: 7, max: 365, default: 90 } as const

const productSource = z.discriminatedUnion("kind", [
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

/** A product rail. */
export const products = z
  .object({
    ...bodyFields,
    type: z.literal("products"),
    title,
    source: productSource,
    limit: z.number().int().min(1).max(LAYOUT_LIMITS.items).default(12),
    /** Cards in a row on a wide screen: 3, 4 or 5 (adr/0049 Ek 2026-11-05). */
    columns,
    /** A "see all" link under the rail. */
    more: optional(storefrontLink),
    /**
     * The rail's own card variant over the theme setting's (adr/0049 Ek
     * 2026-11-14 §3.3, owner's decision 4); null: the setting's. Only the
     * variant: the framed card's E5 fields are the theme setting's everywhere.
     */
    card_variant: optional(z.enum(PRODUCT_CARD_VARIANTS, VARIANT_ERROR)),
  })
  .strict()

/**
 * A stored product rail's card variant as today's list reads it (adr/0049
 * Ek 2026-11-14 §2.3, forgiving on reading): one off the list (taken off
 * since, or a newer build's) is the theme setting's (null). A save is
 * still held to the list.
 */
export function storedCardVariant(section: Record<string, unknown>): Record<string, unknown> {
  const listed: readonly unknown[] = PRODUCT_CARD_VARIANTS
  const variant = section["card_variant"]
  return section["type"] !== "products" ||
    variant === undefined ||
    variant === null ||
    listed.includes(variant)
    ? section
    : { ...section, card_variant: null }
}
