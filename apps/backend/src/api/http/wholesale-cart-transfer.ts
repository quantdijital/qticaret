import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { linkIdOfCart } from "../../workflows/payment-links/cart-guard"
import { repriceCartWorkflow } from "../../workflows/wholesale/steps/carts"
import { wholesaleShopper } from "../../workflows/wholesale/shopper"

interface CartOwner {
  customer_id?: string | null
  completed_at?: Date | string | null
  metadata?: Record<string, unknown> | null
}

async function cartRead(req: MedusaRequest, cartId: string, fields: string[]): Promise<unknown> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields,
    filters: { id: cartId },
  })
  return data[0] ?? null
}

/**
 * Whether the transfer left the cart the session customer's own, still
 * open and not a payment link's (security review M1): only such a cart is
 * priced again. A link's cart keeps the prices its link was made at
 * (adr/0051: its lines are fixed).
 */
async function isOwnOpenCart(req: MedusaRequest, cartId: string, customerId: string) {
  const cart = (await cartRead(req, cartId, [
    "customer_id",
    "completed_at",
    "metadata",
  ])) as CartOwner | null
  return (
    cart !== null &&
    cart.customer_id === customerId &&
    (cart.completed_at === null || cart.completed_at === undefined) &&
    linkIdOfCart(cart.metadata) === null
  )
}

/** One cart priced again; a failure is tried once more (as `repriceOne` does). */
async function reprice(req: MedusaRequest, cartId: string): Promise<void> {
  try {
    await repriceCartWorkflow(req.scope).run({ input: { cart_id: cartId } })
  } catch (error) {
    // The request's id only: never the cart's or the customer's
    logger.warn({
      event: "wholesale.transfer_reprice_retry",
      request_id: req.requestId ?? null,
      err: errorSummary(error),
    })
    await repriceCartWorkflow(req.scope).run({ input: { cart_id: cartId } })
  }
}

/** The answer with the cart read again after its prices changed; as it was without one. */
async function repricedAnswer(req: MedusaRequest, body: unknown): Promise<unknown> {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  const cartId = req.params["id"]
  if (auth?.actor_type !== "customer" || !auth.actor_id || !cartId) {
    return body
  }
  if (!(await wholesaleShopper(req.scope, auth.actor_id)).active) {
    return body
  }
  if (!(await isOwnOpenCart(req, cartId, auth.actor_id))) {
    return body
  }
  await reprice(req, cartId)
  const fields = (req as { queryConfig?: { fields?: string[] } }).queryConfig?.fields
  const cart = fields && fields.length > 0 ? await cartRead(req, cartId, fields) : null
  return cart && body && typeof body === "object" ? { ...body, cart } : body
}

/**
 * A guest's cart taken by a wholesaler signing in (`POST
 * /store/carts/:id/customer`, ADR-0068 §7) is priced again from their
 * groups at once (Medusa's own refresh, `repriceCartWorkflow`, under the
 * cart's lock), so its lines are wholesale before the next page. Runs on
 * Medusa's answer, and only for the session customer's own open cart that
 * no payment link made; anyone else's answer goes as it was. A failure
 * (after one more try) leaves the answer as Medusa gave it, logged with
 * the request's id: the completion check (slice 4) is the backstop. No
 * `methods`: a method-scoped middleware may sort after the core route.
 */
export function repriceWholesaleTransfer(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  if (req.method !== "POST") {
    next()
    return
  }
  const send = res.json.bind(res)
  res.json = (body: unknown) => {
    res.json = send
    if (res.statusCode >= 400) {
      return send(body)
    }
    repricedAnswer(req, body)
      .then(send, (error: unknown) => {
        logger.warn({
          event: "wholesale.transfer_reprice_failed",
          request_id: req.requestId ?? null,
          err: errorSummary(error),
        })
        send(body)
      })
      // The answer itself failing (the client gone): logged, never a crash
      .catch((error: unknown) => {
        logger.warn({ event: "wholesale.transfer_unsent", err: errorSummary(error) })
      })
    return res
  }
  next()
}
