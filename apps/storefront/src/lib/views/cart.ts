import { formatLira } from "@qticaret/ui"
import type { FreeShippingView, Translate } from "@qticaret/ui"

/** Kuruş, so float noise never says "0,00 TL more". */
const kurus = (lira: number): number => Math.round(lira * 100)

/**
 * How near the cart is to free shipping (F4.5): the same amount the
 * backend's rule reads (`item_total`, KDV in, after discounts). Null when
 * the shop gives no free shipping or the cart is empty.
 */
export function freeShippingOf(
  itemTotal: number,
  threshold: number | null,
  t: Translate
): FreeShippingView | null {
  if (threshold === null || threshold <= 0 || itemTotal <= 0) {
    return null
  }
  const left = kurus(threshold) - kurus(itemTotal)
  if (left <= 0) {
    return { message: t("cart.free_shipping_reached"), percent: 100, reached: true }
  }
  return {
    message: t("cart.free_shipping_left", { amount: formatLira(left / 100) }),
    percent: Math.floor((kurus(itemTotal) / kurus(threshold)) * 100),
    reached: false,
  }
}
