import type { PaymentKind } from "../checkout-views"

/**
 * What a shopper just did on a theme's form, told to the storefront
 * (docs/20 "vitrin dönüşüm olayları"): the theme only says it happened,
 * the storefront decides whether anything is measured (the cookie answer)
 * and how. A theme measures nothing itself and loads no tag.
 */
export const SHOP_EVENT = "qt:shop"

export type ShopEvent =
  /** A line went into the cart from the product page. */
  | { type: "add_to_cart"; variantId: string; quantity: number }
  /** The payment step was sent with a way to pay. */
  | { type: "add_payment_info"; payment: PaymentKind }

export function emitShopEvent(event: ShopEvent): void {
  window.dispatchEvent(new CustomEvent<ShopEvent>(SHOP_EVENT, { detail: event }))
}
