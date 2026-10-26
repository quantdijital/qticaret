import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface PromotionSettings {
  /** Whether a cart may carry more than one code (ADR-0024); automatic promotions apply either way. */
  combine_codes: boolean
}

/** Promotion rules (F4.4): codes per cart. */
export const promotionsSection = defineSection<PromotionSettings>(
  "promotions",
  { combine_codes: z.boolean() },
  { combine_codes: false }
)
