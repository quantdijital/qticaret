import { isPaymentLinkCart } from "../cart/payment-link"
import type { CartSnapshot } from "./cart-changes"
import { NO_CART } from "./cart-changes"
import type { AnalyticsEvent, AnalyticsItem } from "./events"
import type { LineFacts } from "./payloads"
import { paidItems } from "./payloads"

/**
 * The cart's events from the cart the server answered (D9): every price
 * the line's own, its total after discounts over its quantity, as the
 * cart and the checkout show it (`paidItems`). KDV in.
 */

interface CartFacts {
  id: string
  item_total: number
  items: readonly LineFacts[]
  metadata?: Record<string, unknown> | null
}

const money = (value: number): number => Math.round(value * 100) / 100

/** Lines of the same variant (with different add-on picks) as one item, at their mean unit price. */
function byVariant(items: readonly AnalyticsItem[]): AnalyticsItem[] {
  const merged = new Map<string, AnalyticsItem & { worth: number | null }>()
  for (const item of items) {
    const worth = item.price === null ? null : item.price * item.quantity
    const kept = merged.get(item.id)
    if (!kept) {
      merged.set(item.id, { ...item, worth })
      continue
    }
    kept.quantity += item.quantity
    kept.worth = kept.worth === null || worth === null ? null : kept.worth + worth
  }
  return [...merged.values()].map(({ worth, ...item }) => ({
    ...item,
    price: worth === null || item.quantity === 0 ? null : money(worth / item.quantity),
  }))
}

/** The cart as the frame shows it, for `watchCart`: no cart, `NO_CART`. */
export function cartSnapshotOf(cart: CartFacts | null): CartSnapshot {
  if (!cart) {
    return NO_CART
  }
  return {
    id: cart.id,
    locked: isPaymentLinkCart(cart.metadata),
    items: byVariant(paidItems(cart.items)),
  }
}

/** The cart page's `view_cart`; nothing for an empty cart. */
export function viewCartEvents(cart: CartFacts | null): AnalyticsEvent[] {
  if (!cart || cart.items.length === 0) {
    return []
  }
  return [{ name: "view_cart", value: money(cart.item_total), items: paidItems(cart.items) }]
}

/**
 * The checkout's `add_shipping_info` once the shipping is chosen (the
 * payment step): the option's name as the tier, the items as at
 * `begin_checkout`. Nothing before a choice.
 */
export function shippingInfoEvents(cart: {
  item_total: number
  items: readonly LineFacts[]
  shipping_methods: readonly { shipping_option_id: string | null; name: string }[]
}): AnalyticsEvent[] {
  const method = cart.shipping_methods[0]
  if (!method) {
    return []
  }
  return [
    {
      name: "add_shipping_info",
      value: money(cart.item_total),
      shippingTier: method.name,
      items: paidItems(cart.items),
    },
  ]
}
