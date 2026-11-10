import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { noteAuditChanges } from "../../../../../http/audit"
import { cpStaff } from "../../../../../http/caller"
import type { PostCpMemberRoleType } from "../../../validators"
import { memberParam } from "../member-param"

/**
 * POST /admin/cp/staff/members/:id (owner, step-up): a member's new role,
 * owner included; the last granted owner keeps theirs (`cp.last_owner`).
 * Takes effect on the member's next request; recorded from and to.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostCpMemberRoleType>,
  res: MedusaResponse
): Promise<void> {
  const id = await memberParam(req)
  const before = await cpStaff(req).memberOf(id)
  await cpStaff(req).setRole(id, req.validatedBody.role, req.auth_context.actor_id)
  noteAuditChanges(req, { role: { from: before?.role ?? null, to: req.validatedBody.role } })
  res.json({ member: { id, role: req.validatedBody.role } })
}
