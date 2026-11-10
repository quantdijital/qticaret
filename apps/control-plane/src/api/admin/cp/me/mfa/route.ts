import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { parseEnv } from "../../../../../lib/env"
import { disableAllFactors, startTotp } from "../../../../../lib/staff/mfa"
import { noteAuditChanges } from "../../../../http/audit"
import { cpStaff } from "../../../../http/caller"
import { endAllSessions } from "../../../../http/sessions"

const identityOf = (req: AuthenticatedMedusaRequest): string => {
  const identity = req.auth_context.auth_identity_id
  if (!identity) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.not_staff")
  }
  return identity
}

/**
 * POST /admin/cp/me/mfa (adr/0061 §3.5): starts setting up 2FA, before it
 * is passed: the authenticator app's secret and its otpauth URL, this
 * answer only. The app shows the control plane's panel address as issuer.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const [user] = await req.scope
    .resolve(Modules.USER)
    .listUsers({ id: req.auth_context.actor_id }, { select: ["email"], take: 1 })
  const started = await startTotp(req.scope, identityOf(req), {
    label: user?.email ?? "staff",
    issuer: new URL(parseEnv().CP_PANEL_URL).host,
  })
  res.setHeader("Cache-Control", "no-store")
  res.json(started)
}

/**
 * DELETE /admin/cp/me/mfa (step-up): one's own 2FA off, to set it up again.
 * Until then this session, as every other, reaches nothing but the setup.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const userId = req.auth_context.actor_id
  const disabled = await disableAllFactors(req.scope, identityOf(req))
  // Every sign-in's 2FA from before ends with it, and every other session (H1)
  await cpStaff(req).endMfa(userId)
  const sessions = await endAllSessions(req, userId, { keepCurrent: true })
  noteAuditChanges(req, { mfa: { from: "enabled", to: "disabled" }, sessions_ended: sessions })
  res.json({ disabled, sessions_ended: sessions })
}
