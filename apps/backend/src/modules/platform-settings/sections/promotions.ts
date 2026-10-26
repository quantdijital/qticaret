import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface PromotionSettings {
  /** Whether a cart may carry more than one code (ADR-0024); automatic promotions apply either way. */
  combine_codes: boolean
  /**
   * Shipping is free from this basket total on (lira, KDV in, after
   * discounts; F4.5): flat-rate options get a 0 price from it. Null: no
   * free shipping threshold.
   */
  free_shipping_threshold: number | null
}

/** Promotion rules (F4.4, F4.5): codes per cart, free shipping from a basket total. */
export const promotionsSection = defineSection<PromotionSettings>(
  "promotions",
  {
    combine_codes: z.boolean(),
    free_shipping_threshold: z.number().positive().max(10_000_000).multipleOf(0.01).nullable(),
  },
  { combine_codes: false, free_shipping_threshold: null }
)
