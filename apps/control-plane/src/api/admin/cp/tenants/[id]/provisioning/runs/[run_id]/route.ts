import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { provisioningIn } from "../../../../../../../../workflows/modules"
import { paramOf, tenantParam } from "../../../../params"
import { runView } from "../../../../provisioning"

/**
 * GET /admin/cp/tenants/:id/provisioning/runs/:run_id (owner, operator):
 * one run with its steps; another shop's run is 404 `cp.run_unknown`.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const run = await provisioningIn(req.scope).runOf(tenant.id, paramOf(req, "run_id"))
  res.setHeader("Cache-Control", "no-store")
  res.json({ run: runView(run) })
}
