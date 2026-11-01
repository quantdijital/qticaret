import { formatLira } from "@qticaret/ui"
import type { CartLineView, FreeShippingView, MiniCartView, Translate } from "@qticaret/ui"
import type { Cart } from "@/lib/cart/cart"

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

/** Discounts in kuruş are compared rounded: no "−0,00 TL" from float noise. */
export const differs = (a: number, b: number) => kurus(a) !== kurus(b)

/** The cart's lines as the cart page and the drawer show them. */
export function cartLinesOf(cart: Cart | null): CartLineView[] {
  return (cart?.items ?? []).map((line) => ({
    id: line.id,
    title: line.title,
    detail: line.variant_title ?? line.subtitle,
    quantity: line.quantity,
    total: formatLira(line.total),
    original: differs(line.original_total, line.total) ? formatLira(line.original_total) : null,
    image: line.thumbnail
      ? {
          src: line.thumbnail,
          alt: line.title,
          width: null,
          height: null,
          sources: { avif: null, webp: null },
        }
      : null,
  }))
}

/** The header drawer's cart; null without lines. */
export function miniCartOf(
  cart: Cart | null,
  threshold: number | null,
  t: Translate
): MiniCartView | null {
  if (!cart || cart.items.length === 0) {
    return null
  }
  return {
    lines: cartLinesOf(cart),
    subtotal: formatLira(cart.item_total),
    freeShipping: freeShippingOf(cart.item_total, threshold, t),
  }
}
