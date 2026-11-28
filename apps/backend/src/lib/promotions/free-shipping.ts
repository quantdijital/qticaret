import { fromMedusaAmount } from "../money"
import type { Kurus } from "../money"
import type {
  FreeShippingCondition,
  PromotionSettings,
} from "../../modules/platform-settings/sections/promotions"

/**
 * The shop's free shipping, in one place (Settings > Shipping > "Kargo
 * ücreti", WooCommerce's "Free shipping requires"): a basket total, and
 * what a free shipping campaign (Kampanyalar: a promotion on the shipping
 * methods, by code or automatic) may do beside it. All of it is read on
 * the server; nothing here comes from a shopper.
 */

type FreeShippingSettings = Pick<
  PromotionSettings,
  "free_shipping_threshold" | "free_shipping_condition"
>

const thresholdOf = (settings: FreeShippingSettings): number | null => {
  const lira = settings.free_shipping_threshold
  return typeof lira === "number" && Number.isFinite(lira) && lira > 0 ? lira : null
}

/** A stored condition, a missing or unknown one read as it worked before the choice. */
export function conditionOf(settings: Partial<FreeShippingSettings>): FreeShippingCondition {
  const read = settings.free_shipping_condition
  return read === "amount" || read === "amount_and_coupon" ? read : "amount_or_coupon"
}

/**
 * The basket total (lira) that frees shipping by itself: what shipping is
 * priced with (adr/0087 §2.5) and what the storefront, feeds and JSON-LD
 * say. Null with no threshold, and when the total needs a free shipping
 * campaign too: then the campaign frees it, never the total alone.
 */
export function standaloneThreshold(settings: FreeShippingSettings): number | null {
  const lira = thresholdOf(settings)
  return lira !== null && conditionOf(settings) !== "amount_and_coupon" ? lira : null
}

/**
 * Whether a free shipping campaign may lower this basket's shipping:
 * - no threshold: always, as any campaign;
 * - "amount": never, the total alone frees it;
 * - "amount_or_coupon": always;
 * - "amount_and_coupon": only at or past the total (exactly it counts).
 * `itemTotal` is the cart's `item_total` (KDV in, after discounts), the
 * same total the threshold is held to.
 */
export function campaignMayFreeShipping(settings: FreeShippingSettings, itemTotal: Kurus): boolean {
  const lira = thresholdOf(settings)
  if (lira === null) {
    return true
  }
  switch (conditionOf(settings)) {
    case "amount":
      return false
    case "amount_and_coupon":
      return itemTotal >= fromMedusaAmount(lira, { allowRounding: true })
    case "amount_or_coupon":
      return true
  }
}

/**
 * Why a free shipping code is not taken now, as the key told to the
 * shopper; null when it may be. The total is not reached ("and"), or the
 * shop frees shipping by the total alone.
 */
export function freeShippingCodeRefusal(
  settings: FreeShippingSettings,
  itemTotal: Kurus
): string | null {
  if (campaignMayFreeShipping(settings, itemTotal)) {
    return null
  }
  return conditionOf(settings) === "amount"
    ? "promotions.free_shipping_code_off"
    : "promotions.free_shipping_code_below_total"
}

/** A promotion's application method, as far as telling a free shipping campaign goes. */
export interface CampaignMethod {
  target_type?: string | null
}

/** Whether a promotion lowers shipping: the panel's "Ücretsiz kargo" is the only kind that does. */
export const lowersShipping = (method: CampaignMethod | null | undefined): boolean =>
  method?.target_type === "shipping_methods"
