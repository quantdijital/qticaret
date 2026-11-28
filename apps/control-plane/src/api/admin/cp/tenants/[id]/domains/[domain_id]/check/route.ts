import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reissuePlanDocuments } from "../../../../../../../../lib/fleet/reissue"
import { checkDomainWorkflow } from "../../../../../../../../workflows/tenants/domain-check"
import { noteAuditChanges } from "../../../../../../../http/audit"
import { paramOf, tenantParam } from "../../../../params"

/**
 * POST /admin/cp/tenants/:id/domains/:domain_id/check (owner, operator):
 * "Doğrula": the custom domain's TXT proof and routing asked of DNS now
 * (F16.7). Only DNS is asked, bounded in time; nothing connects to the
 * host. Once proved, the shop's plan document carries it.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const { result } = await checkDomainWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, domain_id: paramOf(req, "domain_id"), manual: true },
  })
  noteAuditChanges(req, {
    domain_check: { host: result.hostname, from: result.from, to: result.to },
  })
  if (result.proof_changed) {
    await reissuePlanDocuments(req.scope, [tenant.id])
  }
  res.json({
    domain: { id: result.id, verification: result.to, verification_error: result.error },
  })
}
