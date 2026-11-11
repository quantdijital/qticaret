import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { renameTenantWorkflow } from "../../../../../workflows/tenants/tenant-profile"
import { noteAuditChanges, recordReadFirst } from "../../../../http/audit"
import { cpStaff } from "../../../../http/caller"
import { actorOf, tenantParam } from "../params"
import type { PostTenantUpdateType } from "../validators"
import { tenantDetail } from "../views"

/**
 * GET /admin/cp/tenants/:id (all staff): the shop in full: its company
 * (the TCKN masked), contacts, domains, notes, package, exceptions and the
 * limits that apply. Its contacts are personal data: the read is recorded
 * before the answer, and nothing is shown when it cannot be (503, review
 * M2). A reading role sees the contacts' e-mail and phone masked.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const role = await cpStaff(req).roleOf(actorOf(req))
  // Only the roles that call and bill see a contact in full; anything else, masked
  const full = role === "owner" || role === "operator" || role === "finance"
  const detail = await tenantDetail(req, tenant, { maskContacts: !full })
  res.setHeader("Cache-Control", "no-store")
  if (!(await recordReadFirst(req))) {
    res.status(503).json({ type: "unavailable", message: "cp.audit_unavailable" })
    return
  }
  res.json(detail)
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
