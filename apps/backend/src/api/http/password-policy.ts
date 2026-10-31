import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { isBreached, passwordProblem } from "../../lib/security/password"
import { claimsOf } from "./bearer"

/**
 * Whether new passwords are looked up in the breach list: only with
 * `PASSWORD_BREACH_CHECK=on`, read at each request. An outside service,
 * so off until the owner of the platform approves it (adr/0043).
 */
export function breachCheckOn(
  flag: string | undefined = process.env["PASSWORD_BREACH_CHECK"]
): boolean {
  return flag === "on"
}

/**
 * A new password, staff or customer, at registration and at a reset link
 * (`/auth/:actor_type/emailpass/register`, `/update`; F15.1, adr/0043):
 * at least ten characters and at most 256, none people pick first, none
 * holding the address's name, none in a known breach. The list being out
 * of reach lets it through, logged. 400 `auth.password_<problem>`.
 */
export async function newPasswordPolicy(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const body = (req.body ?? {}) as { password?: unknown; email?: unknown }
    if (typeof body.password !== "string") {
      next()
      return
    }
    // A reset names the address in its token
    const named = claimsOf(req)?.["entity_id"]
    const email =
      typeof body.email === "string" ? body.email : typeof named === "string" ? named : null
    const problem = passwordProblem(body.password, email)
    if (problem) {
      next(new ValidationError(`auth.password_${problem}`, { field: "password" }))
      return
    }
    if (breachCheckOn()) {
      const breached = await isBreached(body.password)
      if (breached) {
        next(new ValidationError("auth.password_breached", { field: "password" }))
        return
      }
      if (breached === null) {
        logger.warn({ event: "auth.breach_check_unavailable" })
      }
    }
    next()
  } catch (error) {
    next(error)
  }
}
