import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { shipOrders } from "../../../../workflows/orders/ship-orders"
import type { AdminPostShipOrdersType } from "../../orders/[id]/ship/validators"

/**
 * POST /admin/order-board/ship (F7.7): "Kargoya ver" for the orders picked
 * on the list, each whole; answers each order's outcome.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostShipOrdersType>,
  res: MedusaResponse
): Promise<void> {
  const results = await shipOrders(req.scope, {
    order_ids: req.validatedBody.order_ids,
    notify: req.validatedBody.notify,
    created_by: req.auth_context.actor_id || undefined,
  })
  res.json({ results })
}
