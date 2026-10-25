import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { shipOrderWorkflow } from "../../../../../workflows/orders/ship-order"
import type { AdminPostShipOrderType } from "./validators"

/** Packs what is left (or a packed parcel) and hands it over, as one undoable step (adr/0022). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostShipOrderType>,
  res: MedusaResponse
): Promise<void> {
  const orderId = req.params["id"] ?? ""
  await shipOrderWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      notify: req.validatedBody.notify,
      created_by: req.auth_context.actor_id || undefined,
    },
  })
  res.json({ order_id: orderId })
}
