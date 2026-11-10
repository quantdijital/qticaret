import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cpStaff } from "../../../../../http/caller"
import type { PostCpMemberRoleType } from "../../../validators"
import { memberParam } from "../member-param"

/**
 * POST /admin/cp/staff/members/:id (owner, step-up): a member's new role,
 * owner included; the last active owner keeps theirs (`cp.last_owner`).
 * Takes effect on the member's next request.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostCpMemberRoleType>,
  res: MedusaResponse
): Promise<void> {
  const id = await memberParam(req)
  await cpStaff(req).setRole(id, req.validatedBody.role, req.auth_context.actor_id)
  res.json({ member: { id, role: req.validatedBody.role } })
}
