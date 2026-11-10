import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { renewRecoveryCodes } from "../../../../../../lib/staff/mfa"

/**
 * POST /admin/cp/me/mfa/recovery-codes (step-up, adr/0061 §3.5): new
 * recovery codes, the old ones void, this answer only. Asks the proof: a
 * stolen session would mint its own and prove itself with them.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const identity = req.auth_context.auth_identity_id
  if (!identity) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.not_staff")
  }
  const codes = await renewRecoveryCodes(req.scope, identity)
  res.setHeader("Cache-Control", "no-store")
  res.json({ recovery_codes: codes })
}
