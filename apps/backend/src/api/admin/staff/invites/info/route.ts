import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { inviteOfToken } from "../../../../../workflows/staff/invites"
import type { AdminGetStaffInviteInfoType } from "../../validators"

// Whoever holds the link opens the page before they have an account
export const AUTHENTICATE = false

/**
 * GET /admin/staff/invites/info?token= (F12.6): what the invitation is
 * for, so the page can say it: the address and the role. Nothing without
 * a token that is still good.
 */
export async function GET(
  req: MedusaRequest<unknown, AdminGetStaffInviteInfoType>,
  res: MedusaResponse
): Promise<void> {
  const invite = await inviteOfToken(req.scope, req.validatedQuery.token)
  res.json({ email: invite.email, role: invite.role })
}
