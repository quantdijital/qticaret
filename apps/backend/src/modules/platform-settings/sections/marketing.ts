import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface MarketingSettings {
  /** A shopper who left a cart gets one reminder, with e-mail consent only (F10.7). */
  abandoned_cart_enabled: boolean
  /** Minutes a cart stays unchanged before it counts as left. */
  abandoned_cart_delay_minutes: number
}

/** What the shop sends to sell more (F10, adr/0038): off until the shop turns it on. */
export const marketingSection = defineSection<MarketingSettings>(
  "marketing",
  {
    abandoned_cart_enabled: z.boolean(),
    abandoned_cart_delay_minutes: z.number().int().min(30).max(1440),
  },
  { abandoned_cart_enabled: false, abandoned_cart_delay_minutes: 60 }
)
