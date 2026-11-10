import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { routePathKeepingCaseOf } from "@qticaret/server-kit"
import { decide, matchRoute } from "../../lib/staff/route-table"
import { cpStaff, mfaPassed, userIdOf } from "./caller"
import { checkProof } from "./proofs"
import { rejectRequest, requestTarget } from "./request"

export const STEP_UP_HEADER = "x-cp-step-up"

const MESSAGES = {
  unlisted: [404, "not_found", "errors.not_found"],
  no_role: [403, "not_allowed", "cp.no_role"],
  mfa_required: [403, "not_allowed", "cp.mfa_required"],
  role: [403, "not_allowed", "cp.forbidden"],
} as const

/** The route table's row for the request, read once and kept on it. */
export function routeOf(req: MedusaRequest) {
  return matchRoute(req.method, routePathKeepingCaseOf(requestTarget(req)))
}

/**
 * The platform staff guard (adr/0061 §3.5), on every `/admin/cp/*` request
 * after Medusa's authentication: the route table's row, closed by default.
 * A row's caller must be a user (a secret API key is never staff), an
 * active member, past 2FA unless the row is the setup's, in one of the
 * row's roles, and, for a sensitive change, carry a step-up proof of their
 * own that still holds (`x-cp-step-up`; 428 without or with a stale one).
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
    const role = userId ? await cpStaff(req).roleOf(userId) : null
    const passed = role !== null && (await mfaPassed(req))
    const decision = decide(match?.rule ?? null, { role, mfaPassed: passed })
    if (!decision.allowed) {
      const [status, type, message] = MESSAGES[decision.reason]
      rejectRequest(req, res, status, { type, message }, `cp_staff_${decision.reason}`)
      return
    }
    if (match?.rule.stepUp) {
      const token = req.headers[STEP_UP_HEADER]
      if (typeof token !== "string" || token === "") {
        rejectRequest(
          req,
          res,
          428,
          { type: "not_allowed", message: "cp.step_up_required" },
          "step_up_required"
        )
        return
      }
      const check = checkProof(req, token)
      if (check !== "valid") {
        rejectRequest(
          req,
          res,
          428,
          { type: "not_allowed", message: "cp.step_up_invalid" },
          `step_up_${check}`
        )
        return
      }
    }
    next()
  } catch (error) {
    next(error)
  }
}
