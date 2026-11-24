import type { PaymentKind } from "../checkout-views"
import type { PopupType } from "../popup-views"

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
  /** A pop-up shown, its button or code used, closed, or signed up from (adr/0080 §7). */
  | {
      type: "popup"
      action: "view" | "click" | "close" | "signup"
      popupId: string
      popupType: PopupType
    }

export function emitShopEvent(event: ShopEvent): void {
  window.dispatchEvent(new CustomEvent<ShopEvent>(SHOP_EVENT, { detail: event }))
}
