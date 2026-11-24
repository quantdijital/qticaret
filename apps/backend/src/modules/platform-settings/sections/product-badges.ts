import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

/**
 * The small badge on a product card's photo, each kind turned on by the
 * shop and all off at first (the owner, 2026-11-24). A card shows one:
 * the product's own > "Çok satan" > "Yeni".
 */
export interface ProductBadgeSettings {
  /** The product's own line, written on its page in the panel ("Sınırlı"). */
  manual_enabled: boolean
  /** "Yeni" on a product made within `new_days` days. */
  new_enabled: boolean
  new_days: number
  /** "Çok satan" on a product that sold at least `best_seller_min_units` units in 30 days. */
  best_seller_enabled: boolean
  best_seller_min_units: number
}

export const productBadgesSection = defineSection<ProductBadgeSettings>(
  "product_badges",
  {
    manual_enabled: z.boolean(),
    new_enabled: z.boolean(),
    new_days: z.number().int().min(1).max(365),
    best_seller_enabled: z.boolean(),
    best_seller_min_units: z.number().int().min(1).max(100_000),
  },
  {
    manual_enabled: false,
    new_enabled: false,
    new_days: 30,
    best_seller_enabled: false,
    best_seller_min_units: 10,
  }
)
