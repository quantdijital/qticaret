import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ORDER_LINK_BY_KEY } from "../../workflows/payment-links/paid"

/** Order metadata the shop keeps to itself: who on the staff made the order's payment link. */
const STAFF_KEYS = [ORDER_LINK_BY_KEY]

type Row = { metadata?: unknown } | null | undefined

function withoutStaffKeys(order: Row): void {
  const metadata = order?.metadata
  if (metadata && typeof metadata === "object") {
    for (const key of STAFF_KEYS) {
      Reflect.deleteProperty(metadata, key)
    }
  }
}

/**
 * The Store API's orders (`/store/orders`, `/store/orders/:id`, the cart's
 * completion) without the staff's own keys: Medusa returns an order's
 * metadata to its customer as it is (adr/0051 §13 keeps the link's maker
 * on the order for the panel only).
 */
export function hideStaffOrderKeys(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const send = res.json.bind(res)
  res.json = (body: unknown) => {
    const answer = body as { order?: Row; orders?: Row[] } | null
    withoutStaffKeys(answer?.order)
    for (const order of Array.isArray(answer?.orders) ? answer.orders : []) {
      withoutStaffKeys(order)
    }
    return send(body)
  }
  next()
}

export const ORDER_STAFF_KEY_ROUTES = [
  { matcher: "/store/orders*", middlewares: [hideStaffOrderKeys] },
  { matcher: "/store/carts/:id/complete", middlewares: [hideStaffOrderKeys] },
]
