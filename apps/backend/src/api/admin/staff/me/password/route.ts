import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { changeStaffPasswordWorkflow } from "../../../../../workflows/staff/account"
import { endOtherSessions } from "../../../../http/staff-sessions"
import type { AdminPostStaffPasswordType } from "../../validators"

/**
 * POST /admin/staff/me/password (the owner, 2026-11-06): the signed-in
 * member's own password, with the current one (and their 2FA code when
 * they use it, in the request's proof headers). Their other sessions end;
 * this one stays.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStaffPasswordType>,
  res: MedusaResponse
): Promise<void> {
  const userId = req.auth_context.actor_id
  await changeStaffPasswordWorkflow(req.scope).run({
    input: { ...req.validatedBody, user_id: userId },
  })
  res.json({ changed: true, sessions_ended: await endOtherSessions(req, userId) })
}
