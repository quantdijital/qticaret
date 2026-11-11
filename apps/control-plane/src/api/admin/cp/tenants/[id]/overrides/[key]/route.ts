import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { LimitKey } from "@qticaret/types/control-plane"
import { reissuePlanDocuments } from "../../../../../../../lib/fleet/reissue"
import { setOverrideWorkflow } from "../../../../../../../workflows/plans/tenant-plan"
import { noteAuditChanges } from "../../../../../../http/audit"
import { paramOf, tenantParam } from "../../../params"

/**
 * DELETE /admin/cp/tenants/:id/overrides/:key (owner, operator): the
 * shop's exception for a limit removed; the package's value applies again.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  const key = paramOf(req, "key")
  if (!(LIMIT_KEYS as readonly string[]).includes(key)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.override_unknown")
  }
  const { result: before } = await setOverrideWorkflow(req.scope).run({
    input: { tenant_id: tenant.id, key: key as LimitKey, override: null },
  })
  if (!before) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.override_unknown")
  }
  noteAuditChanges(req, { override: { key, from: before.value, to: "package" } })
  await reissuePlanDocuments(req.scope, [tenant.id])
  res.json({ key, deleted: true })
}
