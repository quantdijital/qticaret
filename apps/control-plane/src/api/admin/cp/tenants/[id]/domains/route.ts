import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { parseEnv } from "../../../../../../lib/env"
import { customHostnameProblem, normalizeHostname } from "../../../../../../lib/tenants/hostname"
import { addDomainWorkflow } from "../../../../../../workflows/tenants/tenant-domains"
import { noteAuditChanges } from "../../../../../http/audit"
import { tenantParam } from "../../params"
import type { PostDomainType } from "../../validators"

/**
 * POST /admin/cp/tenants/:id/domains (owner, operator): the shop's own
 * domain recorded, its DNS check pending (F16.7). A name under the
 * platform's domain is the platform's to give (`cp.domain_platform`).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostDomainType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const hostname = normalizeHostname(req.validatedBody.hostname)
  const problem = customHostnameProblem(hostname, parseEnv().PLATFORM_DOMAIN)
  if (problem) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, problem)
  }
  const { result } = await addDomainWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, hostname },
  })
  noteAuditChanges(req, { domain: { to: hostname } })
  res.json({ domain: { id: result.id, hostname } })
}
