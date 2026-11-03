import { isStoreApiError } from "../store-api/errors"

/** The cart's metadata key naming the link it came from (backend `CART_LINK_KEY`): its id, never its token. */
const PAYMENT_LINK_CART_KEY = "qt_payment_link"

/**
 * A cart opened from a payment link (adr/0051): the backend marks it with
 * the link's id (never its token) and locks its lines, quantities and
 * code. Address, shipping, gift recipients and the way to pay stay the
 * shopper's; cash on delivery is not taken for it.
 */
export function isPaymentLinkCart(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false
  }
  const id = (metadata as Record<string, unknown>)[PAYMENT_LINK_CART_KEY]
  return typeof id === "string" && id !== ""
}

export const LINK_CART_LOCKED = "cart.payment_link_locked"

/** The backend's 400 for a change to a link's cart, as its message key; null for anything else. */
export const linkCartRefusal = (error: unknown): typeof LINK_CART_LOCKED | null =>
  isStoreApiError(error) && error.messageKey === LINK_CART_LOCKED ? LINK_CART_LOCKED : null
