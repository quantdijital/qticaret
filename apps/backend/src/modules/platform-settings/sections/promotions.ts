import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

/**
 * What frees shipping when the shop sets a basket total (WooCommerce's
 * "Free shipping requires"): the total alone (free shipping campaigns do
 * not lower shipping), the total or a free shipping campaign (code or
 * automatic; how it worked before the choice), or both together.
 */
export const FREE_SHIPPING_CONDITIONS = ["amount", "amount_or_coupon", "amount_and_coupon"] as const
export type FreeShippingCondition = (typeof FREE_SHIPPING_CONDITIONS)[number]

export interface PromotionSettings {
  /** Whether a cart may carry more than one code (ADR-0024); automatic promotions apply either way. */
  combine_codes: boolean
  /**
   * Shipping is free from this basket total on (lira, KDV in, after
   * discounts; F4.5), with every option (adr/0087 §2.5). Null: no free
   * shipping threshold.
   */
  free_shipping_threshold: number | null
  /** What the threshold needs beside the total; read only while a threshold is set. */
  free_shipping_condition: FreeShippingCondition
}

/** Promotion rules (F4.4, F4.5): codes per cart, free shipping from a basket total. */
export const promotionsSection = defineSection<PromotionSettings>(
  "promotions",
  {
    combine_codes: z.boolean(),
    free_shipping_threshold: z.number().positive().max(10_000_000).multipleOf(0.01).nullable(),
    free_shipping_condition: z.enum(FREE_SHIPPING_CONDITIONS),
  },
  {
    combine_codes: false,
    free_shipping_threshold: null,
    // Before the choice a free shipping campaign lowered shipping below the total too
    free_shipping_condition: "amount_or_coupon",
  }
)
