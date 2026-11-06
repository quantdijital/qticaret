import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { confirmStaffEmailChangeWorkflow } from "../../../../../workflows/staff/email-change"
import type { AdminPostStaffEmailConfirmType } from "../../validators"

// The link may be opened where nobody is signed in: the token is the proof
export const AUTHENTICATE = false

/**
 * POST /admin/staff/email/confirm (the owner, 2026-11-06): the link sent
 * to a member's new address, confirmed. The login and the user move to it
 * together; the link is spent, and the old address is told.
 */
export async function POST(
  req: MedusaRequest<AdminPostStaffEmailConfirmType>,
  res: MedusaResponse
): Promise<void> {
  await confirmStaffEmailChangeWorkflow(req.scope).run({
    input: { token: req.validatedBody.token },
  })
  res.json({ changed: true })
}
