import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, base, columns, optional, recordId, title } from "../layout-fields"
import { storefrontLink } from "../menus"
import { collectionSource, manualSource } from "./sources"

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
    ...base,
    type: z.literal("products"),
    title,
    source: productSource,
    limit: z.number().int().min(1).max(LAYOUT_LIMITS.items).default(12),
    /** Cards in a row on a wide screen: 3, 4 or 5 (adr/0049 Ek 2026-11-05). */
    columns,
    /** A "see all" link under the rail. */
    more: optional(storefrontLink),
  })
  .strict()
