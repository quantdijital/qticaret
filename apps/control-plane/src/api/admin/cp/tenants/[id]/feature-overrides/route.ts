import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reissuePlanDocuments } from "../../../../../../lib/fleet/reissue"
import { setFeatureOverrideWorkflow } from "../../../../../../workflows/plans/tenant-plan"
import { noteAuditChanges } from "../../../../../http/audit"
import { actorOf, tenantParam } from "../../params"
import type { PostFeatureOverrideType } from "../../validators"

/**
 * POST /admin/cp/tenants/:id/feature-overrides (owner, operator; Ek C9):
 * the shop's own value for one platform flag, over its package's, with
 * the reason and, optionally, when it ends. Replaces the key's exception
 * if there is one. Recorded from and to (the reason by its field name
 * only); the shop's plan document follows.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostFeatureOverrideType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { key, enabled, reason, expires_at } = req.validatedBody
  const { result: before } = await setFeatureOverrideWorkflow(req.scope).run({
    input: {
      tenant_id: tenant.id,
      key,
      override: {
        enabled,
        reason,
        expires_at: expires_at ? new Date(expires_at) : null,
        created_by: actorOf(req),
      },
    },
  })
  noteAuditChanges(req, {
    feature_override: { key, from: before ? before.enabled : "package", to: enabled },
  })
  await reissuePlanDocuments(req.scope, [tenant.id])
  res.json({ feature_override: { key, enabled } })
}
