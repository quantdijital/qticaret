import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { acceptCpStaffInviteWorkflow } from "../../../../../workflows/cp-staff/invites"
import type { PostCpInviteAcceptType } from "../../validators"

// The new member has a login but no user yet: the route's own middleware takes that token
export const AUTHENTICATE = false

/**
 * POST /admin/cp/invites/accept (adr/0061 §3.5): with the token of a login
 * just registered for the invited address, the member is made with the
 * invitation's role. They set 2FA up before anything else.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostCpInviteAcceptType>,
  res: MedusaResponse
): Promise<void> {
  const { auth_identity_id: authIdentityId, actor_id: actorId } = req.auth_context
  if (!authIdentityId || actorId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.invite_login")
  }
  const { result } = await acceptCpStaffInviteWorkflow(req.scope).run({
    input: { ...req.validatedBody, auth_identity_id: authIdentityId },
  })
  res.status(201).json({ member: { id: result.user_id, role: result.role } })
}
