import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { campaignReport } from "../../../../../workflows/campaigns/report"

/**
 * GET /admin/bulk-messages/:id/report (adr/0050 §9): reached, skipped with
 * reasons, failed, bounces and complaints, unsubscribes within the week,
 * and the carts, orders and revenue its links brought. Numbers only.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ report: await campaignReport(req.scope, req.params["id"] ?? "") })
}
