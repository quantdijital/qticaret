import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { dashboardOf } from "../../../../lib/dashboard/overview"

/**
 * GET /admin/cp/dashboard (all staff; adr/0061 C18, Ek C18): shops by
 * status, monthly recurring revenue (trials apart), overdue payments,
 * renewals in the next 30 days, unhealthy and silent shops and version
 * drift. Read only; amounts and days, shop names and addresses: nothing
 * the payments and shops lists do not show every role already (not
 * recorded).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json(await dashboardOf(req.scope, new Date()))
}
