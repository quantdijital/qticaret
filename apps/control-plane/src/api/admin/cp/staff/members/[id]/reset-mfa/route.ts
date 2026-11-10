import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { disableAllFactors, loginOf } from "../../../../../../../lib/staff/mfa"
import { endAllSessions } from "../../../../../../http/sessions"
import { memberParam } from "../../member-param"

/**
 * POST /admin/cp/staff/members/:id/reset-mfa (owner, step-up): a member's
 * 2FA turned off, their phone lost; their sessions end, and they set it up
 * again at their next sign-in. One's own goes through `DELETE /me/mfa`.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await memberParam(req)
  if (id === req.auth_context.actor_id) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.reset_self")
  }
  const [user] = await req.scope
    .resolve(Modules.USER)
    .listUsers({ id }, { select: ["email"], take: 1 })
  const login = user ? await loginOf(req.scope, user.email) : null
  const factors = login ? await disableAllFactors(req.scope, login) : 0
  const sessions = await endAllSessions(req, id)
  res.json({ member: { id }, factors, sessions_ended: sessions })
}
