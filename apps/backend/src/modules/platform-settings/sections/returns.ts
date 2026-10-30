import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

/**
 * The shop's return policy (F13.6, adr/0041 §3): how long a customer may
 * withdraw (14 days at least, by law), and who pays to send an item back.
 * The return requests, the legal texts' `{iade_süresi}` and the products'
 * `hasMerchantReturnPolicy` read it.
 */
export interface ReturnsSettings {
  /** Days from delivery; never fewer than the law's 14. */
  withdrawal_days: number
  /** Who pays to send an item back: the shop (a free return) or the customer. */
  return_shipping: "shop" | "customer"
}

export const MIN_WITHDRAWAL_DAYS = 14

export const returnsSection = defineSection<ReturnsSettings>(
  "returns",
  {
    withdrawal_days: z
      .number()
      .int()
      .min(MIN_WITHDRAWAL_DAYS, { message: "platform_settings.withdrawal_days_invalid" })
      .max(365, { message: "platform_settings.withdrawal_days_invalid" }),
    return_shipping: z.enum(["shop", "customer"]),
  },
  { withdrawal_days: MIN_WITHDRAWAL_DAYS, return_shipping: "shop" }
)
