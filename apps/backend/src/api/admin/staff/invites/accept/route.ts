import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../lib/errors"
import { acceptStaffInviteWorkflow } from "../../../../../workflows/staff/invites"
import type { AdminPostStaffAcceptType } from "../../validators"

// The new member has a login but no user yet: the route's own middleware takes that token
export const AUTHENTICATE = false

/**
 * POST /admin/staff/invites/accept (F12.6, adr/0040 §4): with the token of
 * a login just registered for the invited address, the member is made with
 * the invitation's role. Medusa's own `/admin/invites/accept` gives no
 * role: a user made through it reaches nothing.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStaffAcceptType>,
  res: MedusaResponse
): Promise<void> {
  const { auth_identity_id: authIdentityId, actor_id: actorId } = req.auth_context
  if (!authIdentityId || actorId) {
    throw new ValidationError("staff.invite_login")
  }
  const { result } = await acceptStaffInviteWorkflow(req.scope).run({
    input: { ...req.validatedBody, auth_identity_id: authIdentityId },
  })
  res.status(201).json({ member: { id: result.user_id, role: result.role } })
}
