import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sealForRequest } from "../../../../../lib/staff/account"
import { changeStaffPasswordWorkflow } from "../../../../../workflows/staff/account"
import { newPasswordBinding } from "../../../../../workflows/staff/account-steps"
import { provedLoginOf } from "../../../../http/own-password"
import { endOtherSessions, renewSession } from "../../../../http/staff-sessions"
import type { AdminPostStaffPasswordType } from "../../validators"

/**
 * POST /admin/staff/me/password (the owner, 2026-11-06): the signed-in
 * member's own password. The current one was proved before this (and
 * their 2FA code, when they use it); the new one goes to the workflow
 * sealed for this request. Their other sessions end and this one gets a
 * new id.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStaffPasswordType>,
  res: MedusaResponse
): Promise<void> {
  const userId = req.auth_context.actor_id
  const login = provedLoginOf(req)
  await changeStaffPasswordWorkflow(req.scope).run({
    input: {
      user_id: userId,
      auth_identity_id: login.auth_identity_id,
      email: login.email,
      sealed_password: sealForRequest(req.validatedBody.new_password, newPasswordBinding(userId)),
    },
  })
  const ended = await endOtherSessions(req, userId)
  await renewSession(req, userId)
  res.json({ changed: true, sessions_ended: ended })
}
