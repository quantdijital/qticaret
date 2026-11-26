import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { linkIdOfCart } from "../../workflows/payment-links/cart-guard"
import { wholesaleShopper } from "../../workflows/wholesale/shopper"
import { cartRoute, sentCodes } from "../validation/promotion-codes"

interface CartOwner {
  customer_id?: string | null
  metadata?: Record<string, unknown> | null
}

/** The cart's customer; none for a guest's cart, an unknown one or a payment link's (adr/0051). */
async function ownerOf(req: MedusaRequest, cartId: string): Promise<string | null> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["customer_id", "metadata"],
    filters: { id: cartId },
  })
  const cart = data[0] as CartOwner | undefined
  return cart && linkIdOfCart(cart.metadata) === null ? (cart.customer_id ?? null) : null
}

const session = authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true })

/** The session's customer, for a cart being made (Medusa's route makes it theirs). */
export function sessionCustomer(req: MedusaRequest, res: MedusaResponse): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const done = (error?: unknown) => {
      if (error) {
        reject(error instanceof Error ? error : new Error("session not read"))
        return
      }
      const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
      resolve(auth?.actor_type === "customer" && auth.actor_id ? auth.actor_id : null)
    }
    // Medusa's authenticate hands its own failures to `done`
    session(req, res, done)
  })
}

/**
 * ADR-0068 §6: a wholesaler's cart takes no discount code. A code sent to
 * one (made with codes, codes set or added) is refused with
 * `promotions.wholesale_no_code` before Medusa's route, so the shopper is
 * told why; taking a code off is never refused. Runs after the code tries
 * were counted (`couponTries`), so the coupon limit counts these too. The
 * cart's customer decides, never the request; a guest's cart and a payment
 * link's are left to the code rules as they were. The backstops: Medusa's
 * promotion rules never apply a code to such a cart
 * (`hooks/cart-promotion-context.ts`) and the completion refuses one.
 */
export async function refuseWholesaleCodes(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  try {
    const route = cartRoute(req)
    if (!route || route.mode === "remove" || (sentCodes(req)?.length ?? 0) === 0) {
      next()
      return
    }
    const customerId = route.cartId
      ? await ownerOf(req, route.cartId)
      : await sessionCustomer(req, res)
    if (customerId && (await wholesaleShopper(req.scope, customerId)).active) {
      throw new ValidationError("promotions.wholesale_no_code", { field: "promo_codes" })
    }
    next()
  } catch (error) {
    next(error)
  }
}
