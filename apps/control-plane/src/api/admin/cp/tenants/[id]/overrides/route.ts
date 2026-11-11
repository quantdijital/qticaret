import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setOverrideWorkflow } from "../../../../../../workflows/plans/tenant-plan"
import { noteAuditChanges } from "../../../../../http/audit"
import { actorOf, tenantParam } from "../../params"
import type { PostOverrideType } from "../../validators"

/**
 * POST /admin/cp/tenants/:id/overrides (owner, operator): the shop's own
 * value for one limit, over its package's (null: no limit), with the
 * reason and, optionally, when it ends. Replaces the key's exception if
 * there is one. Recorded from and to (the reason by its field name only).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostOverrideType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { key, value, reason, expires_at } = req.validatedBody
  const { result: before } = await setOverrideWorkflow(req.scope).run({
    input: {
      tenant_id: tenant.id,
      key,
      override: {
        value,
        reason,
        expires_at: expires_at ? new Date(expires_at) : null,
        created_by: actorOf(req),
      },
    },
  })
  noteAuditChanges(req, {
    override: { key, from: before ? before.value : "package", to: value },
  })
  res.json({ override: { key, value } })
}
