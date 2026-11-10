import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TOTP_CODE } from "@qticaret/server-kit"
import { authOf } from "./caller"
import { codeFirstUse } from "./proofs"
import { rejectRequest } from "./request"

/**
 * `POST /auth/mfa/challenges/:id/verify`, a sign-in's second step, takes an
 * app code once, in the same count as a step-up (the shop's F15.1 rule): a
 * code a real-time phishing proxy relays neither signs in a second time nor
 * proves a sensitive change. Only the app's six digits; Medusa takes a
 * recovery code once itself. Runs after Medusa's authentication and body
 * validation.
 */
export async function signInCodeOnce(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const identity = authOf(req)?.auth_identity_id
    const { method, code } = (req.validatedBody ?? req.body ?? {}) as {
      method?: unknown
      code?: unknown
    }
    if (!identity || method !== "totp") {
      next()
      return
    }
    if (
      typeof code !== "string" ||
      !TOTP_CODE.test(code) ||
      !(await codeFirstUse(req, identity, code))
    ) {
      rejectRequest(
        req,
        res,
        401,
        { type: "unauthorized", message: "cp.mfa_code_used" },
        "mfa_code_used"
      )
      return
    }
    next()
  } catch (error) {
    next(error)
  }
}
