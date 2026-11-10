import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { confirmTotp } from "../../../../../../lib/staff/mfa"
import { codeFirstUse, countWrong, provePassword } from "../../../../../http/proofs"
import { rejectRequest } from "../../../../../http/request"
import type { PostCpMfaVerifyType } from "../../../validators"

/**
 * POST /admin/cp/me/mfa/verify (adr/0061 §3.5): the setup confirmed with
 * its first code and the member's password (a session alone must not put
 * someone else's app on the account), then the first recovery codes, this
 * answer only. Wrong proofs count as a step-up's do. The code is spent: it
 * signs nothing in afterwards. The member then signs in again with a code.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostCpMfaVerifyType>,
  res: MedusaResponse
): Promise<void> {
  const identity = req.auth_context.auth_identity_id
  if (!identity) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.not_staff")
  }
  const [user] = await req.scope
    .resolve(Modules.USER)
    .listUsers({ id: req.auth_context.actor_id }, { select: ["email"], take: 1 })
  const { code, password } = req.validatedBody
  const proved = await provePassword(req, identity, user?.email ?? "", password)
  if (proved !== "ok") {
    const locked = proved === "locked"
    const message = locked ? "cp.step_up_locked" : "cp.password_invalid"
    rejectRequest(req, res, locked ? 429 : 403, { type: "not_allowed", message }, message)
    return
  }
  const confirmed = (await codeFirstUse(req, identity, code))
    ? await confirmTotp(req.scope, identity, code)
    : null
  if (!confirmed) {
    await countWrong(req, identity)
    const message = "cp.mfa_code_invalid"
    rejectRequest(req, res, 403, { type: "not_allowed", message }, message)
    return
  }
  res.setHeader("Cache-Control", "no-store")
  res.json(confirmed)
}
