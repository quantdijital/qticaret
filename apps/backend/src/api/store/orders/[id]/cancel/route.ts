import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cancelOrderForCustomer } from "../../../../../workflows/orders/customer-cancel"
import { orderAccessOf } from "../../../../http/order-access"

/**
 * POST /store/orders/:id/cancel (F7.13): the shopper cancels their own
 * order before it is packed, signed in or with the order's key (adr/0037
 * §2); what they paid comes back. A shipped order is refused, to be
 * returned instead.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const access = orderAccessOf(req)
  const result = await cancelOrderForCustomer(req.scope, {
    order_id: access.order_id,
    customer_id: access.customer_id ?? "",
  })
  res.json({ order_id: result.order_id, canceled: true })
}
