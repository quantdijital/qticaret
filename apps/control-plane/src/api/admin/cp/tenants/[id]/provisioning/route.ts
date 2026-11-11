import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseEnv } from "../../../../../../lib/env"
import { provisioningIn } from "../../../../../../workflows/modules"
import { tenantParam } from "../../params"
import { runView, startFromRequest } from "../../provisioning"

/**
 * GET /admin/cp/tenants/:id/provisioning (owner, operator): the shop's
 * setup runs, newest first, the latest with its steps, and which
 * provisioner this control plane has (null: none, nothing can be started).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const runs = provisioningIn(req.scope)
  const list = await runs.runsOf(tenant.id)
  const latest = list[0] ? await runs.runOf(tenant.id, list[0].id) : null
  res.setHeader("Cache-Control", "no-store")
  res.json({
    provisioner: parseEnv().CP_PROVISIONER ?? null,
    latest: latest ? runView(latest) : null,
    runs: list.map(runView),
  })
}

/**
 * POST /admin/cp/tenants/:id/provisioning (owner, operator, step-up): the
 * shop set up, or set up again after a failure (adr/0061 §6.2: from the
 * start, skipping what exists). 202 with the run; its steps follow on GET.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  await startFromRequest(req, res, "create")
}
