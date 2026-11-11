import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isPlatformFlag } from "@qticaret/types/control-plane"
import { reissuePlanDocuments } from "../../../../../../../lib/fleet/reissue"
import { setFeatureOverrideWorkflow } from "../../../../../../../workflows/plans/tenant-plan"
import { noteAuditChanges } from "../../../../../../http/audit"
import { paramOf, tenantParam } from "../../../params"

/**
 * DELETE /admin/cp/tenants/:id/feature-overrides/:key (owner, operator;
 * Ek C9): the shop's exception for a platform flag removed; the package's
 * value (or the default) applies again, and the plan document follows.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const key = paramOf(req, "key")
  if (!isPlatformFlag(key, process.env["NODE_ENV"])) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.override_unknown")
  }
  const { result: before } = await setFeatureOverrideWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, key, override: null },
  })
  if (!before) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.override_unknown")
  }
  noteAuditChanges(req, { feature_override: { key, from: before.enabled, to: "package" } })
  await reissuePlanDocuments(req.scope, [tenant.id])
  res.json({ key, deleted: true })
}
