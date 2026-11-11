import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { usageHealthOf } from "../../../../../../lib/fleet/usage-health-view"
import { tenantParam } from "../../params"

/**
 * GET /admin/cp/tenants/:id/usage-health (all staff; Ek C13): the shop's
 * latest usage report (totals only), whether the hourly report is
 * overdue, and its backend's and storefront's health standing with their
 * last probes. Nothing personal: the read is not recorded.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  res.setHeader("Cache-Control", "no-store")
  res.json(await usageHealthOf(req.scope, tenant, new Date()))
}
