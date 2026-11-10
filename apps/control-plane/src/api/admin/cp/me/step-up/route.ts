import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { issueProof, proveFactor } from "../../../../http/proofs"
import { rejectRequest } from "../../../../http/request"
import type { PostCpStepUpType } from "../../validators"

/**
 * POST /admin/cp/me/step-up (adr/0061 §3.5, Ek C4): the member proves
 * themselves again with their app's code (once) or a recovery code (once)
 * and gets a proof for five minutes, bound to them and this session, sent
 * as `x-cp-step-up` with each sensitive change. A wrong code: 403
 * `cp.step_up_failed`; too many: 429 `cp.step_up_locked`.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostCpStepUpType>,
  res: MedusaResponse
): Promise<void> {
  const identity = req.auth_context.auth_identity_id
  if (!identity) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.not_staff")
  }
  const { method, code } = req.validatedBody
  const outcome = await proveFactor(req, identity, method, code)
  if (outcome !== "ok") {
    const locked = outcome === "locked"
    const message = locked ? "cp.step_up_locked" : "cp.step_up_failed"
    rejectRequest(req, res, locked ? 429 : 403, { type: "not_allowed", message }, message)
    return
  }
  const proof = issueProof(req)
  if (!proof) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.not_staff")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({ step_up: { token: proof.token, expires_at: new Date(proof.expiresAt).toISOString() } })
}
