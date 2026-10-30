import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { inviteOfToken } from "../../../../../workflows/staff/invites"
import type { AdminPostStaffInviteInfoType } from "../../validators"

// Whoever holds the link opens the page before they have an account
export const AUTHENTICATE = false

/**
 * POST /admin/staff/invites/info (F12.6): what the invitation is for, so
 * the page can say it: the address and the role. Nothing without a token
 * that is still good. A POST, so the token travels in the body, never in a
 * URL an access log keeps; it reads only.
 */
export async function POST(
  req: MedusaRequest<AdminPostStaffInviteInfoType>,
  res: MedusaResponse
): Promise<void> {
  const invite = await inviteOfToken(req.scope, req.validatedBody.token)
  res.json({ email: invite.email, role: invite.role })
}
