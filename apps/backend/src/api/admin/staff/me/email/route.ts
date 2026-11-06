import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requestStaffEmailChangeWorkflow } from "../../../../../workflows/staff/email-change"
import type { AdminPostStaffEmailType } from "../../validators"

/**
 * POST /admin/staff/me/email (the owner, 2026-11-06): the signed-in
 * member asks to sign in with a new address, with their current password
 * (and 2FA code). Nothing changes yet: a link goes to the new address,
 * a notice to the old one.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStaffEmailType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await requestStaffEmailChangeWorkflow(req.scope).run({
    input: { ...req.validatedBody, user_id: req.auth_context.actor_id },
  })
  res.status(202).json({ sent: true, expires_at: result.expires_at })
}
