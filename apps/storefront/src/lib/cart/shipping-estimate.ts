import "server-only"
import { isStoreApiError } from "../store-api/errors"
import { storeGet } from "../store-api/server"
import type { ShippingEstimate } from "../views/shipping-estimate"

/**
 * The cart's shipping before an address (`GET /store/carts/:id/shipping-estimate`):
 * the shop's main option as the backend prices it, never worked out here.
 * Null when the backend does not answer (an older one, a cart gone): the
 * cart then says the checkout works it out, as before.
 */
export async function cartShippingEstimate(cartId: string): Promise<ShippingEstimate | null> {
  try {
    const { shipping_estimate: estimate } = await storeGet<{
      shipping_estimate?: ShippingEstimate
    }>(`/store/carts/${encodeURIComponent(cartId)}/shipping-estimate`)
    return estimate ?? null
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}
