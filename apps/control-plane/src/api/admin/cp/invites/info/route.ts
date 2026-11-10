import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { inviteOfToken } from "../../../../../workflows/cp-staff/invites"
import type { PostCpInviteInfoType } from "../../validators"

// Whoever holds the link opens the page before they have an account
export const AUTHENTICATE = false

/**
 * POST /admin/cp/invites/info (public, adr/0061 §3.5): what the invitation
 * is for, so the page can say it: the address and the role. Nothing without
 * a token that is still good. A POST, so the token travels in the body,
 * never in a URL an access log keeps; it reads only.
 */
export async function POST(
  req: MedusaRequest<PostCpInviteInfoType>,
  res: MedusaResponse
): Promise<void> {
  const invite = await inviteOfToken(req.scope, req.validatedBody.token)
  res.setHeader("Cache-Control", "no-store")
  res.json({ email: invite.email, role: invite.role })
}
