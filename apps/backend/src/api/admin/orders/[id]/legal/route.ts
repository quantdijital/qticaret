import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { orderAgeDeclaration, orderLegalRecord } from "../../../../../workflows/legal/order-record"

/**
 * GET /admin/orders/:id/legal (F13.2, adr/0041 §2): the shopper's consent
 * to the contracts (when, from which IP address, which versions) and the
 * copies kept with the order, and the age the buyer declared for a
 * restricted product (F13.3). A recorded read: it holds personal data.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const orderId = req.params["id"] ?? ""
  const [consent, ageDeclaration] = await Promise.all([
    orderLegalRecord(req.scope, orderId),
    orderAgeDeclaration(req.scope, orderId),
  ])
  res.json({ consent, age_declaration: ageDeclaration })
}
