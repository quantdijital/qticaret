import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { primaryDomainWorkflow } from "../../../../../../../../workflows/tenants/tenant-domains"
import { noteAuditChanges } from "../../../../../../../http/audit"
import { paramOf, tenantParam } from "../../../../params"

/**
 * POST /admin/cp/tenants/:id/domains/:domain_id/primary (owner,
 * operator): the shop's primary address; a verified domain only
 * (`cp.domain_unverified`: the storefront's links would break).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const { result } = await primaryDomainWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, domain_id: paramOf(req, "domain_id") },
  })
  noteAuditChanges(req, { primary_domain: result })
  res.json({ primary: result.to })
}
