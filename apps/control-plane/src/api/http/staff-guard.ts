import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { routePathKeepingCaseOf } from "@qticaret/server-kit"
import { decide, matchRoute } from "../../lib/staff/route-table"
import type { RouteRule } from "../../lib/staff/route-table"
import {
  authOf,
  checkCredential,
  cpStaff,
  credentialOf,
  mfaPassed,
  standingOf,
  userIdOf,
} from "./caller"
import { checkProof } from "./proofs"
import { rejectRequest, requestTarget } from "./request"

export const STEP_UP_HEADER = "x-cp-step-up"

/** How recent a sign-in's 2FA stands in for a step-up where the table allows it. */
export const FRESH_SIGN_IN_MS = 5 * 60 * 1000

const MESSAGES = {
  unlisted: [404, "not_found", "errors.not_found"],
  no_role: [403, "not_allowed", "cp.no_role"],
  mfa_required: [403, "not_allowed", "cp.mfa_required"],
  role: [403, "not_allowed", "cp.forbidden"],
  session_revoked: [401, "unauthorized", "cp.session_revoked"],
  token_revoked: [401, "unauthorized", "cp.session_revoked"],
  session_required: [401, "unauthorized", "cp.session_required"],
} as const

const refuse = (req: MedusaRequest, res: MedusaResponse, reason: keyof typeof MESSAGES) => {
  const [status, type, message] = MESSAGES[reason]
  rejectRequest(req, res, status, { type, message }, `cp_staff_${reason}`)
}

/** The route table's row for the request. */
export function routeOf(req: MedusaRequest) {
  return matchRoute(req.method, routePathKeepingCaseOf(requestTarget(req)))
}

function signedInLately(req: MedusaRequest): boolean {
  const completed = authOf(req)?.mfa_challenge_completed_at
  const at = completed ? new Date(completed).getTime() : Number.NaN
  return !Number.isNaN(at) && Date.now() - at < FRESH_SIGN_IN_MS
}

function stepUpRefusal(req: MedusaRequest, rule: RouteRule): string | null {
  const token = req.headers[STEP_UP_HEADER]
  if (typeof token !== "string" || token === "") {
    return rule.freshSignIn && signedInLately(req) ? null : "cp.step_up_required"
  }
  return checkProof(req, token) === "valid" ? null : "cp.step_up_invalid"
}

/**
 * The platform staff guard (adr/0061 §3.5, Ek C4), on every `/admin/cp/*`
 * request after Medusa's authentication: the route table's row, closed by
 * default. The caller must be a user (a secret API key is never staff)
 * whose credential still holds (a session in their index; a bearer token
 * only in development and test, newer than their last revocation), an
 * active member, granted (a pending one reaches the setup only, until its
 * deadline), past 2FA since their last factor change unless the row is the
 * setup's, in one of the row's roles, and, for a sensitive change, carry a
 * step-up proof of their own credential that still holds (428 otherwise).
 */
export async function guardCpStaff(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  try {
    const match = routeOf(req)
    if (match?.rule.access === "public") {
      next()
      return
    }
    const userId = userIdOf(req)
    if (match && !userId) {
      // A key, or a login without a user: Medusa let it through, staff it is not
      rejectRequest(req, res, 401, { type: "unauthorized", message: "cp.not_staff" }, "not_staff")
      return
    }
    const member = userId ? await cpStaff(req).memberOf(userId) : null
    if (match && userId) {
      const credential = await checkCredential(credentialOf(req), userId, member)
      if (credential !== "ok") {
        refuse(req, res, credential)
        return
      }
    }
    const { role, pending } = standingOf(member)
    const passed = role !== null && !pending && (await mfaPassed(req, member))
    const decision = decide(match?.rule ?? null, { role, pending, mfaPassed: passed })
    if (!decision.allowed) {
      refuse(req, res, decision.reason)
      return
    }
    const refusal = match?.rule.stepUp ? stepUpRefusal(req, match.rule) : null
    if (refusal) {
      rejectRequest(req, res, 428, { type: "not_allowed", message: refusal }, refusal)
      return
    }
    next()
  } catch (error) {
    next(error)
  }
}
