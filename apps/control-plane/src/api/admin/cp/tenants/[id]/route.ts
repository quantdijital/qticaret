import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { renameTenantWorkflow } from "../../../../../workflows/tenants/tenant-profile"
import { noteAuditChanges } from "../../../../http/audit"
import { tenantParam } from "../params"
import type { PostTenantUpdateType } from "../validators"
import { tenantDetail } from "../views"

/**
 * GET /admin/cp/tenants/:id (all staff): the shop in full: its company
 * (the TCKN masked), contacts, domains, notes, package, exceptions and the
 * limits that apply. Its contacts are personal data: the read is recorded.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await tenantDetail(req, await tenantParam(req)))
}

/** POST /admin/cp/tenants/:id (owner, operator): the shop's name; its slug is fixed. */
export async function POST(
  req: AuthenticatedMedusaRequest<PostTenantUpdateType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { result } = await renameTenantWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, name: req.validatedBody.name },
  })
  noteAuditChanges(req, { name: result })
  res.json({ tenant: { id: tenant.id, name: result.to } })
}
