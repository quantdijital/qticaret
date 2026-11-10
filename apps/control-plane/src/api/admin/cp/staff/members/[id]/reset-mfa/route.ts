import { randomBytes } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { sendEnrolment } from "../../../../../../../lib/staff/invites"
import { disableAllFactors, loginOf } from "../../../../../../../lib/staff/mfa"
import { ENROL_WINDOW_MS } from "../../../../../../../workflows/cp-staff/invites"
import { noteAuditChanges } from "../../../../../../http/audit"
import { cpStaff, keyed } from "../../../../../../http/caller"
import { endAllSessions } from "../../../../../../http/sessions"
import { memberParam } from "../../member-param"

/**
 * POST /admin/cp/staff/members/:id/reset-mfa (owner, step-up; Ek C4, M3):
 * a member's 2FA turned off, their phone lost. Their sessions and tokens
 * end, and they set 2FA up again only through a single-use enrolment link
 * sent to their address, within a day; past it they reach nothing until
 * an owner resets again. The link in this answer too, for the owner to
 * pass on when no e-mail goes out (`mailed: false`). One's own goes
 * through `DELETE /me/mfa`.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await memberParam(req)
  if (id === req.auth_context.actor_id) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.reset_self")
  }
  const [user] = await req.scope
    .resolve(Modules.USER)
    .listUsers({ id }, { select: ["email"], take: 1 })
  const email = user?.email ?? ""
  const login = email ? await loginOf(req.scope, email) : null
  const factors = login ? await disableAllFactors(req.scope, login) : 0
  const token = randomBytes(32).toString("base64url")
  await cpStaff(req).requireEnrolment(
    id,
    keyed("cp_enrol", token),
    new Date(Date.now() + ENROL_WINDOW_MS)
  )
  const sessions = await endAllSessions(req, id)
  const sent = await sendEnrolment(req.scope, email, token)
  noteAuditChanges(req, { mfa: { from: "enabled", to: "reset" }, sessions_ended: sessions })
  res.setHeader("Cache-Control", "no-store")
  res.json({ member: { id }, factors, sessions_ended: sessions, ...sent })
}
