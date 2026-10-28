import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cancelOrderForCustomer } from "../../../../../workflows/orders/customer-cancel"

/**
 * POST /store/orders/:id/cancel (F7.13): the signed-in shopper cancels
 * their own order before it is packed; what they paid comes back. A
 * shipped order is refused, to be returned instead.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const result = await cancelOrderForCustomer(req.scope, {
    order_id: req.params["id"] ?? "",
    customer_id: req.auth_context.actor_id,
  })
  res.json({ order_id: result.order_id, canceled: true })
}
