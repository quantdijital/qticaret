import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { noteAuditChanges } from "../../../../../../http/audit"
import { cpStaff } from "../../../../../../http/caller"
import { endAllSessions } from "../../../../../../http/sessions"
import { memberParam } from "../../member-param"

/**
 * POST /admin/cp/staff/members/:id/deactivate (owner, step-up): the
 * member's access taken away, their sessions and tokens ended; their
 * account and history stay. Not oneself, never the last granted owner.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await memberParam(req)
  if (id === req.auth_context.actor_id) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.deactivate_self")
  }
  const before = await cpStaff(req).memberOf(id)
  await cpStaff(req).deactivate(id)
  const sessions = await endAllSessions(req, id)
  noteAuditChanges(req, {
    active: { from: before?.active ?? null, to: false },
    sessions_ended: sessions,
  })
  res.json({ member: { id, active: false }, sessions_ended: sessions })
}
