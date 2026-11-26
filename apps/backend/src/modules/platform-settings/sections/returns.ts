import { z } from "@medusajs/framework/zod"
import { defineSection, isCleanText } from "./define"

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
  /**
   * The shop sells package travel (adr/0076 §8, K9): a dated booking
   * cancelled 30 days or more before its day keeps nothing, whatever the
   * product's tiers say, and the shopper is told the refund comes within
   * 14 days. A plain switch, no sector in the code.
   */
  package_travel: boolean
  /**
   * The shop's contracted return codes (adr/0031 Ek 2026-11-26, "anlaşmalı
   * iade kodu"): the one code a carrier gives a shop under contract, which
   * the shopper says at any branch so the parcel comes back at the shop's
   * cost. Shown on an approved return (`contractedReturnOf` picks one).
   * `other_*`: the carrier BirFatura's cargo module ships with, not ours,
   * named by the shop. Shop config, not a secret.
   */
  contracted_return: ContractedReturnCodes
}

export interface ContractedReturnCodes {
  aras: string | null
  yurtici: string | null
  other_carrier: string | null
  other_code: string | null
}

export const MIN_WITHDRAWAL_DAYS = 14

// Carriers' codes are digits and letters, now and then with a dash or a space between
const returnCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ./-]{0,38}[A-Za-z0-9])?$/, {
    message: "platform_settings.return_code_invalid",
  })
  .nullable()

export const returnsSection = defineSection<ReturnsSettings>(
  "returns",
  {
    withdrawal_days: z
      .number()
      .int()
      .min(MIN_WITHDRAWAL_DAYS, { message: "platform_settings.withdrawal_days_invalid" })
      .max(365, { message: "platform_settings.withdrawal_days_invalid" }),
    return_shipping: z.enum(["shop"], { message: "platform_settings.return_shipping_shop_only" }),
    package_travel: z.boolean(),
    contracted_return: z
      .object({
        aras: returnCode,
        yurtici: returnCode,
        other_carrier: z
          .string()
          .trim()
          .min(1)
          .max(60)
          .refine((value) => isCleanText(value), { message: "platform_settings.text_invalid" })
          .nullable(),
        other_code: returnCode,
      })
      .strict(),
  },
  {
    withdrawal_days: MIN_WITHDRAWAL_DAYS,
    return_shipping: "shop",
    package_travel: false,
    contracted_return: { aras: null, yurtici: null, other_carrier: null, other_code: null },
  },
  (values, ctx) => {
    // BirFatura's carrier is named by the shop: a code without its carrier tells the shopper nothing
    const { other_carrier, other_code } = values.contracted_return
    if ((other_carrier === null) !== (other_code === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["contracted_return", other_carrier === null ? "other_carrier" : "other_code"],
        message: "platform_settings.return_carrier_both",
      })
    }
  }
)
