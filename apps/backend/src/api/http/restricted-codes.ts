import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { linkIdOfCart } from "../../workflows/payment-links/cart-guard"
import type { Buyer } from "../../workflows/promotions/first-order"
import { restrictedCodeRefusal } from "../../workflows/promotions/restricted-codes"
import { cartRoute, sentCodes } from "../validation/promotion-codes"
import { sessionCustomer } from "./wholesale-codes"

interface CartBuyer {
  customer_id?: string | null
  email?: string | null
  metadata?: Record<string, unknown> | null
}

// An e-mail the same request sets on the cart is the buyer's from now on
const sentEmail = (req: MedusaRequest): string | null => {
  const email = (req.body as Record<string, unknown> | undefined)?.["email"]
  return typeof email === "string" && email.trim() ? email.trim() : null
}

/** The cart's buyer; null for a payment link's cart, whose code staff set (adr/0051). */
async function buyerOf(
  req: MedusaRequest,
  res: MedusaResponse,
  cartId: string | null
): Promise<Buyer | null> {
  if (!cartId) {
    return { customerId: await sessionCustomer(req, res), email: sentEmail(req) }
  }
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["customer_id", "email", "metadata"],
    filters: { id: cartId },
  })
  const cart = data[0] as CartBuyer | undefined
  if (!cart || linkIdOfCart(cart.metadata) !== null) {
    return null
  }
  return { customerId: cart.customer_id ?? null, email: sentEmail(req) ?? cart.email ?? null }
}

/**
 * K1/K2: a code for some customer groups, or for a first order only, sent
 * by a buyer it is not for is refused with why (log in, not this account,
 * not a first order) before Medusa's route, which would only leave it off
 * the cart. Taking a code off is never refused. The buyer is the cart's,
 * never the request's word; Medusa's rules (`hooks/cart-promotion-context.ts`)
 * and the checkout (`hooks/complete-cart-validate.ts`) hold the same line.
 */
export async function refuseRestrictedCodes(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  try {
    const route = cartRoute(req)
    const codes = sentCodes(req) ?? []
    if (!route || route.mode === "remove" || codes.length === 0) {
      next()
      return
    }
    const buyer = await buyerOf(req, res, route.cartId)
    const refusal = buyer ? await restrictedCodeRefusal(req.scope, codes, buyer) : null
    if (refusal) {
      throw new ValidationError(refusal, { field: "promo_codes" })
    }
    next()
  } catch (error) {
    next(error)
  }
}
