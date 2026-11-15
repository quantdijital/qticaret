import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { repriceCartWorkflow } from "../../workflows/wholesale/steps/carts"
import { wholesaleShopper } from "../../workflows/wholesale/shopper"

/** The cart as Medusa's own route answers it: the fields the request asked for. */
async function cartAgain(req: MedusaRequest, cartId: string): Promise<unknown> {
  const fields = (req as { queryConfig?: { fields?: string[] } }).queryConfig?.fields
  if (!fields || fields.length === 0) {
    return null
  }
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields,
    filters: { id: cartId },
  })
  return data[0] ?? null
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
  await repriceCartWorkflow(req.scope).run({ input: { cart_id: cartId } })
  const cart = await cartAgain(req, cartId)
  return cart && body && typeof body === "object" ? { ...body, cart } : body
}

/**
 * A guest's cart taken by a wholesaler signing in (`POST
 * /store/carts/:id/customer`, ADR-0068 §7) is priced again from their
 * groups at once (Medusa's own refresh, `repriceCartWorkflow`, under the
 * cart's lock), so its lines are wholesale before the next page. Runs on
 * Medusa's answer (the transfer done, the session's customer the cart's);
 * anyone else's answer goes as it was. A failure leaves the answer as
 * Medusa gave it, logged: the completion check (slice 4) is the backstop.
 * No `methods`: a method-scoped middleware may sort after the core route.
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
        logger.warn({ event: "wholesale.transfer_reprice_failed", err: errorSummary(error) })
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
