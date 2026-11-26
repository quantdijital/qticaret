import { formatLira } from "@qticaret/ui"
import type { Translate } from "@qticaret/ui"

/**
 * The backend's estimate of the cart's shipping before an address (the
 * shop's main option through the quote checkout charges): "free",
 * "priced" with `amount` (lira, KDV in), "at_checkout" when only the
 * destination or a carrier's quote can say, "not_needed" when nothing
 * travels. A status this build does not know is read as "at_checkout".
 */
export interface ShippingEstimate {
  status: string
  amount: number | null
}

/**
 * The cart page's "Kargo" row in words: "Ücretsiz", "90,00 TL", or
 * "Ödeme adımında hesaplanır" when only the checkout can price it; null
 * when nothing travels or the backend gave no answer (the row then says
 * what it said before). Never a figure of our own.
 */
export function shippingEstimateText(
  estimate: ShippingEstimate | null,
  t: Translate
): string | null {
  if (!estimate || estimate.status === "not_needed") {
    return null
  }
  if (estimate.status === "free") {
    return t("checkout.free")
  }
  const amount = estimate.amount
  if (estimate.status === "priced" && typeof amount === "number" && Number.isFinite(amount)) {
    return Math.round(amount * 100) <= 0 ? t("checkout.free") : formatLira(amount)
  }
  return t("cart.shipping_calculated_at_checkout")
}

/**
 * The drawer's row: only a figure the server gave ("Ücretsiz", "90,00 TL");
 * otherwise none, and the drawer's own note says the checkout works it out.
 */
export function drawerShippingOf(estimate: ShippingEstimate | null, t: Translate): string | null {
  const text = shippingEstimateText(estimate, t)
  return estimate?.status === "free" || estimate?.status === "priced" ? text : null
}
