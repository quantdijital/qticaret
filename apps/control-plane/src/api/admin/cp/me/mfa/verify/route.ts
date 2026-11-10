import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { TOTP_CODE, safeEqual } from "@qticaret/server-kit"
import { confirmTotp } from "../../../../../../lib/staff/mfa"
import { cpStaff, keyed } from "../../../../../http/caller"
import { codeFirstUse, countWrong, provePassword } from "../../../../../http/proofs"
import { rejectRequest } from "../../../../../http/request"
import { endAllSessions } from "../../../../../http/sessions"
import type { PostCpMfaVerifyType } from "../../../validators"

const refuse = (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  status: 403 | 429,
  message: string
) => {
  rejectRequest(req, res, status, { type: "not_allowed", message }, message)
}

/**
 * POST /admin/cp/me/mfa/verify (adr/0061 §3.5, Ek C4): the setup confirmed
 * with its first code and the member's password (a session alone must not
 * put someone else's app on the account); after a 2FA reset, the e-mailed
 * enrolment token too (M3). Then the first recovery codes, this answer
 * only; the member's role is granted (a pending one) and every other
 * session ends: 2FA from before this counts no more (H1). The code is
 * spent. The member then signs in again with a code.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostCpMfaVerifyType>,
  res: MedusaResponse
): Promise<void> {
  const { actor_id: userId, auth_identity_id: identity } = req.auth_context
  if (!identity) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.not_staff")
  }
  const staff = cpStaff(req)
  const member = await staff.memberOf(userId)
  const { code, password, enrolment_token: token } = req.validatedBody
  if (
    member?.enrolTokenHash &&
    (token === undefined || !safeEqual(keyed("cp_enrol", token), member.enrolTokenHash))
  ) {
    refuse(req, res, 403, "cp.enrolment_token_invalid")
    return
  }
  if (member?.bootstrap && (await staff.hasActiveOwner())) {
    refuse(req, res, 403, "cp.owner_exists")
    return
  }
  const [user] = await req.scope
    .resolve(Modules.USER)
    .listUsers({ id: userId }, { select: ["email"], take: 1 })
  const proved = await provePassword(req, identity, user?.email ?? "", password)
  if (proved !== "ok") {
    refuse(
      req,
      res,
      proved === "locked" ? 429 : 403,
      proved === "locked" ? "cp.step_up_locked" : "cp.password_invalid"
    )
    return
  }
  const confirmed =
    TOTP_CODE.test(code) && (await codeFirstUse(req, identity, code))
      ? await confirmTotp(req.scope, identity, code)
      : null
  if (!confirmed) {
    await countWrong(req, identity)
    refuse(req, res, 403, "cp.mfa_code_invalid")
    return
  }
  await staff.activate(userId)
  await endAllSessions(req, userId, { keepCurrent: true })
  res.setHeader("Cache-Control", "no-store")
  res.json(confirmed)
}
