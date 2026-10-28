import { authenticate } from "@medusajs/framework/http"
import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { opensOrder, orderAccessKey } from "../../lib/orders"
import { rejectRequest } from "./reject"

/** Where a guest's client sends the order's key: a header, so it stays out of URLs and logs. */
export const ORDER_TOKEN_HEADER = "x-order-token"

/** Who may act on the order, once `orderAccess` let the request in. */
export interface OrderAccess {
  order_id: string
  /** The order's own customer record (a guest's too): what the order workflows check. */
  customer_id: string | null
  by: "customer" | "token"
}

export type OrderAccessRequest = MedusaRequest & { order_access?: OrderAccess }

/** A signed-in customer when there is one; a guest goes on without. */
export const optionalCustomer = authenticate("customer", ["session", "bearer"], {
  allowUnauthenticated: true,
})

/** The access `orderAccess` granted; a route behind it always has one. */
export function orderAccessOf(req: MedusaRequest): OrderAccess {
  const access = (req as OrderAccessRequest).order_access
  if (!access) {
    throw new Error("order route without orderAccess")
  }
  return access
}

/**
 * Lets a request at `/store/orders/:id…` through for the order's own
 * signed-in customer, or a guest holding the order's key (adr/0037 §2).
 * Anyone else is told there is no such order: Medusa opens an order to
 * whoever has its id (2.21.2), and the id travels in links and logs.
 */
export async function orderAccess(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const orderId = req.params["id"] ?? ""
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", "email", "customer_id"],
      filters: { id: orderId },
    })
    const order = data[0] as
      { id: string; email: string | null; customer_id: string | null } | undefined
    const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
    const customer = auth?.actor_type === "customer" && auth.actor_id ? auth.actor_id : null
    const token = req.headers[ORDER_TOKEN_HEADER]
    const by =
      order && customer !== null && order.customer_id === customer
        ? "customer"
        : order && typeof token === "string" && opensOrder(orderAccessKey(), token, order)
          ? "token"
          : null
    if (!order || !by) {
      rejectRequest(
        req,
        res,
        404,
        { type: "not_found", message: "orders.unknown" },
        "order_access_refused"
      )
      return
    }
    ;(req as OrderAccessRequest).order_access = {
      order_id: order.id,
      customer_id: order.customer_id,
      by,
    }
    next()
  } catch (error) {
    next(error)
  }
}

/** A rate limit's count for an order route: the customer, else the order a guest holds. */
export function orderActor(req: MedusaRequest): string | undefined {
  // An unregistered identity's actor id is "": it counts as a guest
  const actor = (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id
  return actor === undefined || actor === "" ? req.params["id"] : actor
}

/**
 * `GET /store/orders/:id`, Medusa's own route, behind `orderAccess`.
 * No `methods` on its route on purpose (a method-scoped middleware may
 * sort after the core route): the method is checked here.
 */
export function orderPageAccess(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (req.method !== "GET") {
    next()
    return
  }
  optionalCustomer(req, res, (error?: unknown) => {
    if (error) {
      next(error)
      return
    }
    void orderAccess(req, res, next)
  })
}
