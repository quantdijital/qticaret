import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { orderMessages } from "../../../../../workflows/messaging/history"

/**
 * GET /admin/orders/:id/messages (F12.8): what the customer was sent about
 * the order, and what was not sent and why. Addresses masked.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await orderMessages(req.scope, req.params["id"] ?? ""))
}
