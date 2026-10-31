import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../../../lib/errors"
import { resetStaffMfaWorkflow } from "../../../../../../workflows/staff/mfa"
import { tellMfaChanged } from "../../../../../http/mfa-notice"

/**
 * POST /admin/staff/members/:id/reset-mfa (owner; F12.6, adr/0040): a
 * member's 2FA turned off, their phone lost. One's own goes through
 * Settings > Security, with its code.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  if (id === req.auth_context.actor_id) {
    throw new ValidationError("staff.reset_self")
  }
  const [user] = await req.scope
    .resolve(Modules.USER)
    .listUsers({ id }, { select: ["id", "email"], take: 1 })
  if (!user) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "staff.unknown")
  }
  const { result } = await resetStaffMfaWorkflow(req.scope).run({ input: { email: user.email } })
  if (result > 0) {
    tellMfaChanged(req.scope, id, "reset")
  }
  res.json({ id, factors: result })
}
