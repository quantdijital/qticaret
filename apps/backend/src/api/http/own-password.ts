import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ValidationError, isValidationError } from "../../lib/errors"
import { provePassword } from "../../workflows/staff/account-steps"
import { countWrongProof, proofsLocked } from "./reauth"
import { rejectRequest } from "./reject"

/** The caller's login as their current password proved it, for the handler. */
export interface ProvedLogin {
  email: string
  auth_identity_id: string
}

const PROVED = Symbol("proved_login")

/** The login `proveOwnPassword` proved on this request. */
export function provedLoginOf(req: MedusaRequest): ProvedLogin {
  const login = (req as unknown as Record<symbol, ProvedLogin | undefined>)[PROVED]
  if (!login) {
    throw new Error("staff.own_password_not_proved")
  }
  return login
}

/**
 * One's own current password, proved before any workflow runs (security
 * review 2026-11-06): no workflow carries it. A wrong one counts in the
 * step-up's tally (api/http/reauth.ts: ten in a quarter of an hour, thirty
 * in a day, from any address), and past it the person is stopped (429)
 * before the password is even tried. The password leaves the body here.
 */
export async function proveOwnPassword(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
    const identity = auth?.auth_identity_id
    const body = (req.validatedBody ?? {}) as { current_password?: unknown }
    if (auth?.actor_type !== "user" || !identity || typeof body.current_password !== "string") {
      rejectRequest(
        req,
        res,
        403,
        { type: "not_allowed", message: "errors.users_only" },
        "own_password_without_login"
      )
      return
    }
    if (await proofsLocked(identity)) {
      rejectRequest(
        req,
        res,
        429,
        { type: "not_allowed", message: "staff.reauth_locked" },
        "reauth_locked"
      )
      return
    }
    const password = body.current_password
    delete body.current_password
    try {
      const login = await provePassword(req.scope, {
        user_id: auth.actor_id,
        auth_identity_id: identity,
        password,
      })
      ;(req as unknown as Record<symbol, ProvedLogin>)[PROVED] = login
    } catch (error) {
      if (isValidationError(error)) {
        await countWrongProof(identity)
      }
      throw error
    }
    // A password change must change it
    if ((body as { new_password?: unknown }).new_password === password) {
      throw new ValidationError("staff.password_same", { field: "new_password" })
    }
    next()
  } catch (error) {
    next(error)
  }
}
