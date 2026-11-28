import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reissuePlanDocuments } from "../../../../../../../lib/fleet/reissue"
import { removeDomainWorkflow } from "../../../../../../../workflows/tenants/tenant-domains"
import { noteAuditChanges } from "../../../../../../http/audit"
import { paramOf, tenantParam } from "../../../params"

/**
 * DELETE /admin/cp/tenants/:id/domains/:domain_id (owner, operator): a
 * custom domain removed (step-up: a live storefront's address may go);
 * the platform's subdomain is kept always and, if the removed one was
 * primary, becomes primary again. The shop's plan document follows.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const { result } = await removeDomainWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, domain_id: paramOf(req, "domain_id") },
  })
  noteAuditChanges(req, { domain: { from: result.hostname, to: null } })
  await reissuePlanDocuments(req.scope, [tenant.id])
  res.json({ id: result.id, deleted: true })
}
