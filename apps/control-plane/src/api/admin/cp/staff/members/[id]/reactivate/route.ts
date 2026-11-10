import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { noteAuditChanges } from "../../../../../../http/audit"
import { cpStaff } from "../../../../../../http/caller"
import { endAllSessions } from "../../../../../../http/sessions"
import { memberParam } from "../../member-param"

/**
 * POST /admin/cp/staff/members/:id/reactivate (owner, step-up): access
 * back, with the old role. Nothing from before comes back with it: every
 * session and token ends, and the member signs in again with a code.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await memberParam(req)
  const before = await cpStaff(req).memberOf(id)
  await cpStaff(req).reactivate(id)
  await endAllSessions(req, id)
  noteAuditChanges(req, { active: { from: before?.active ?? null, to: true } })
  res.json({ member: { id, active: true } })
}
