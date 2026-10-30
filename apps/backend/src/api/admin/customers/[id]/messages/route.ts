import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { customerMessages } from "../../../../../workflows/messaging/history"

/**
 * GET /admin/customers/:id/messages (F12.8): everything the customer was
 * sent, and what was not sent and why. Addresses masked.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await customerMessages(req.scope, req.params["id"] ?? ""))
}
