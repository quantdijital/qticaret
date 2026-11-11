import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reissuePlanDocuments } from "../../../../lib/fleet/reissue"
import type { ManualStatusMove } from "../../../../lib/tenants/status-moves"
import { moveTenantStatusWorkflow } from "../../../../workflows/tenants/tenant-status"
import { noteAuditChanges } from "../../../http/audit"
import { actorOf, tenantParam } from "./params"
import type { PostStatusMoveType } from "./validators"

const STATUS_TRANSITION = "cp.status_transition"

/**
 * A suspension or its end from the panel (Ek C15, owner and operator,
 * step-up): the move along the contract's transitions (409
 * `cp.status_transition` otherwise), its row with the reason, the audit
 * from and to (the reason stays on the status row, not in the audit), then
 * the shop's plan document issued again and pushed, so the shop hears the
 * new status at once (its pull within 15 minutes if the push fails). The
 * reissue never fails the move: the reconcile job covers it.
 */
export async function moveFromRequest(
  req: AuthenticatedMedusaRequest<PostStatusMoveType>,
  res: MedusaResponse,
  move: ManualStatusMove
): Promise<void> {
  const tenant = await tenantParam(req)
  let moved: { from: string; to: string }
  try {
    const { result } = await moveTenantStatusWorkflow(req.scope).run({
      input: { tenant_id: tenant.id, move, actor: actorOf(req), note: req.validatedBody.reason },
    })
    moved = result
  } catch (error) {
    // The shop is not where the move starts (as the setup's `provisioning.tenant_status`)
    if ((error as { message?: unknown } | null)?.message === STATUS_TRANSITION) {
      res.status(409).json({ type: "conflict", message: STATUS_TRANSITION })
      return
    }
    throw error
  }
  const result = moved
  noteAuditChanges(req, { status: { from: result.from, to: result.to } })
  const issued = (await reissuePlanDocuments(req.scope, [tenant.id])).get(tenant.id)
  res.json({
    tenant: { id: tenant.id, status: result.to },
    plan_document: issued ? { issued: issued.issued, serial: issued.serial } : null,
  })
}
