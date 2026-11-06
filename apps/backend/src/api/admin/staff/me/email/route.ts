import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requestStaffEmailChangeWorkflow } from "../../../../../workflows/staff/email-change"
import { provedLoginOf } from "../../../../http/own-password"
import type { AdminPostStaffEmailType } from "../../validators"

/**
 * POST /admin/staff/me/email (the owner, 2026-11-06): the signed-in
 * member asks to sign in with a new address; their current password (and
 * 2FA code) proved before this. Nothing changes yet: it waits as their
 * one pending change, a link goes to the new address, a notice to the
 * old one. Who holds the new address is not said here.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStaffEmailType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await requestStaffEmailChangeWorkflow(req.scope).run({
    input: {
      user_id: req.auth_context.actor_id,
      from: provedLoginOf(req).email,
      to: req.validatedBody.email,
    },
  })
  res.status(202).json({ sent: true, expires_at: result.expires_at })
}
