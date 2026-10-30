import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deliverOrders } from "../../../../workflows/orders/deliver-orders"
import type { AdminPostDeliverOrdersType } from "./validators"

/**
 * POST /admin/order-board/deliver (F12.3): "Teslim edildi" for the orders
 * picked on the list, the shop's own deliveries; answers each order's outcome.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostDeliverOrdersType>,
  res: MedusaResponse
): Promise<void> {
  res.json({ results: await deliverOrders(req.scope, req.validatedBody.order_ids) })
}
