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
  /**
   * Who pays to send an item back: always the shop (adr/0032 Ek
   * 2026-11-03). Since 1.1.2026 a withdrawal's return through the carrier
   * the shop names costs the customer nothing, nor when it names none (MSY
   * md. 12/5; md. 13/3 repealed by RG 24.5.2025/32909); a faulty item's is
   * the shop's anyway (TKHK md. 11). "customer" was dropped, a stored one
   * moved to "shop" (`migration-scripts/returns-shipping-shop.ts`). Kept
   * as a field until the panel drops its control.
   */
  return_shipping: "shop"
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
    return_shipping: z.enum(["shop"], { message: "platform_settings.return_shipping_shop_only" }),
  },
  { withdrawal_days: MIN_WITHDRAWAL_DAYS, return_shipping: "shop" }
)
