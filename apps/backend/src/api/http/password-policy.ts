import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { isBreached, passwordProblem } from "../../lib/security/password"
import { claimsOf } from "./bearer"

/**
 * Whether new passwords are looked up in the breach list (adr/0043,
 * approved 2026-10-31): on wherever a shop may be live, off only on an
 * explicit development or test environment, where it would reach an
 * outside service each run. An unset NODE_ENV counts as live, as it does
 * for the rest of the platform (the F15 security review).
 * `PASSWORD_BREACH_CHECK=on|off` overrides either; both read trimmed, as
 * the environment check reads them, at each request.
 */
export function breachCheckOn(
  flag: string | undefined = process.env["PASSWORD_BREACH_CHECK"],
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): boolean {
  const setting = flag?.trim()
  if (setting) {
    return setting === "on"
  }
  const environment = nodeEnv?.trim()
  return environment !== "development" && environment !== "test"
}

/**
 * What is wrong with a new password, as its error key, or null (adr/0043):
 * the rule first, then the breach list where it is on. The list being out
 * of reach lets it through, logged. Also a staff member's own change.
 */
export async function newPasswordProblem(
  password: string,
  email: string | null
): Promise<string | null> {
  const problem = passwordProblem(password, email)
  if (problem) {
    return `auth.password_${problem}`
  }
  if (breachCheckOn()) {
    const breached = await isBreached(password)
    if (breached) {
      return "auth.password_breached"
    }
    if (breached === null) {
      logger.warn({ event: "auth.breach_check_unavailable" })
    }
  }
  return null
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
    const problem = await newPasswordProblem(body.password, email)
    if (problem) {
      next(new ValidationError(problem, { field: "password" }))
      return
    }
    next()
  } catch (error) {
    next(error)
  }
}
