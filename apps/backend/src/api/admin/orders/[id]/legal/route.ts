import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { orderLegalRecord } from "../../../../../workflows/legal/order-record"

/**
 * GET /admin/orders/:id/legal (F13.2, adr/0041 §2): the shopper's consent
 * to the contracts (when, from which IP address, which versions) and the
 * copies kept with the order. A recorded read: it holds personal data.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ consent: await orderLegalRecord(req.scope, req.params["id"] ?? "") })
}
