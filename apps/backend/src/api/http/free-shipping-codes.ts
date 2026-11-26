import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { freeShippingCodeRefusalOf } from "../../workflows/promotions/free-shipping-condition"
import { cartRoute, sentCodes } from "../validation/promotion-codes"

/**
 * A free shipping code the shop's condition does not take now (Settings >
 * Shipping > "Kargo ücreti", "Koşul") is refused with why before Medusa's
 * route, which would only leave it off the cart: the basket is below the
 * total a code needs, or the shop frees shipping by the total alone. The
 * basket is the cart's as stored, never the request's word; Medusa's
 * computation (`hooks/cart-promotion-context.ts`) and the checkout hold
 * the same line. Taking a code off is never refused.
 */
export async function refuseFreeShippingCodes(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  try {
    const route = cartRoute(req)
    const codes = sentCodes(req) ?? []
    if (!route || route.mode === "remove" || codes.length === 0) {
      next()
      return
    }
    const refusal = await freeShippingCodeRefusalOf(req.scope, codes, route.cartId)
    if (refusal) {
      throw new ValidationError(refusal, { field: "promo_codes" })
    }
    next()
  } catch (error) {
    next(error)
  }
}
