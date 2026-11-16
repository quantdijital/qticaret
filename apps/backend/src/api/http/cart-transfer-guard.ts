import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { linkIdOfCart } from "../../workflows/payment-links/cart-guard"

interface CartOwner {
  customer_id?: string | null
  completed_at?: Date | string | null
  metadata?: Record<string, unknown> | null
  customer?: { has_account?: boolean | null } | null
}

/**
 * Whether a cart may move to this signed-in customer: open, opened by no
 * payment link (adr/0051: its lines are fixed), and nobody's yet, a
 * guest's (a customer record without an account), or theirs already.
 */
export function mayTakeCart(cart: CartOwner | null, customerId: string): boolean {
  if (!cart || (cart.completed_at !== null && cart.completed_at !== undefined)) {
    return false
  }
  if (linkIdOfCart(cart.metadata) !== null) {
    return false
  }
  const owner = cart.customer_id ?? null
  return owner === null || owner === customerId || cart.customer?.has_account === false
}

async function ownerOf(req: MedusaRequest, cartId: string): Promise<CartOwner | null> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["customer_id", "completed_at", "metadata", "customer.has_account"],
    filters: { id: cartId },
  })
  return (data[0] as CartOwner | undefined) ?? null
}

// Medusa's own answer to a cart it does not have: one answer for every cart that cannot move
const notMovable = () => new MedusaError(MedusaError.Types.NOT_FOUND, "cart.unknown")

/**
 * `POST /store/carts/:id/customer` (security review of ADR-0068 slice 3,
 * M1): Medusa 2.21.2's transfer moves any cart it is named, a registered
 * customer's, a completed one, a payment link's, and prices its lines again
 * for the caller. The cart moves here only when `mayTakeCart` allows it;
 * any other, an unknown id among them, is answered as a cart that does not
 * exist, before Medusa's route runs, so nothing is changed and nothing is
 * told about someone else's cart. The storefront's sign-in leaves a cart
 * that cannot move as it is. Every signed-in customer, not only
 * wholesalers. No `methods` (a method-scoped middleware may sort after the
 * core route): the method is checked here.
 */
export async function guardCartTransfer(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  if (req.method !== "POST") {
    next()
    return
  }
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  const cartId = req.params["id"]
  if (auth?.actor_type !== "customer" || !auth.actor_id || !cartId) {
    // Medusa's route refuses a request with no customer itself
    next()
    return
  }
  try {
    next(mayTakeCart(await ownerOf(req, cartId), auth.actor_id) ? undefined : notMovable())
  } catch (error) {
    next(error)
  }
}

const signedIn = authenticate("customer", ["session", "bearer"])

/** The session's customer, read for a POST only (the guard's own; Medusa's route asks again). */
export function customerOnPost(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (req.method !== "POST") {
    next()
    return
  }
  signedIn(req, res, next)
}
