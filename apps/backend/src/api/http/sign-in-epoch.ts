import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { claimsOf } from "./bearer"
import { heldPasswordChange, holdPasswordChange } from "./password-epoch-cache"
import { PASSWORD_CHANGED_AT } from "./password-change"
import { rejectRequest } from "./reject"

/**
 * A changed password ends every sign-in made before it (ADR-0068 Ek
 * 2026-11-15 (2)): not only at a refresh or a new session
 * (`password-change.ts`) but on every Store request. Staff set a
 * wholesaler's password, or take an address over from an unconfirmed
 * sign-up; a token or session of the one before keeps nothing, so it
 * never reaches wholesale prices. Only ever refuses: a forged token's
 * claims can only refuse its own request (Medusa checks the signature).
 */

/** Where a customer's session keeps when it was opened (seconds), set at `POST /auth/session`. */
export const SESSION_SIGNED_IN_AT = "qt_signed_in_at"

// Medusa's session lifetime (medusa-config `sessionOptions.ttl`)
const SESSION_SECONDS = 10 * 60 * 60

interface SessionLike {
  auth_context?: { auth_identity_id?: unknown } | null
  [SESSION_SIGNED_IN_AT]?: unknown
  destroy?: (callback: (error?: unknown) => void) => void
}

const sessionOf = (req: MedusaRequest) =>
  (req as unknown as { session?: SessionLike | null }).session ?? null

async function passwordChangedAt(req: MedusaRequest, identityId: string): Promise<number | null> {
  const held = heldPasswordChange(identityId)
  if (held !== undefined) {
    return held
  }
  const at = await (async () => {
    const identity = await req.scope
      .resolve(Modules.AUTH)
      .retrieveAuthIdentity(identityId)
      .catch(() => null)
    const changed = identity?.app_metadata?.[PASSWORD_CHANGED_AT]
    const seconds =
      typeof changed === "string" ? Math.floor(new Date(changed).getTime() / 1000) : NaN
    return Number.isFinite(seconds) ? seconds : null
  })()
  holdPasswordChange(identityId, at)
  return at
}

/** The sign-in a request carries: its identity, and when it was made (seconds) if known. */
export function signInOf(req: MedusaRequest): { identity: string; at: number | null } | null {
  const claims = claimsOf(req)
  if (typeof claims?.["auth_identity_id"] === "string") {
    const issued = claims["iat"]
    return { identity: claims["auth_identity_id"], at: typeof issued === "number" ? issued : 0 }
  }
  const session = sessionOf(req)
  const identity = session?.auth_context?.auth_identity_id
  if (typeof identity !== "string") {
    return null
  }
  const at = session?.[SESSION_SIGNED_IN_AT]
  return { identity, at: typeof at === "number" ? at : null }
}

/**
 * Whether a sign-in made at `at` is older than the password: a session
 * from before this note was kept (`at` null) counts as older while the
 * change is younger than a session can live.
 */
export function signInOutlived(
  at: number | null,
  changedAt: number | null,
  now: number = Date.now() / 1000
): boolean {
  if (changedAt === null) {
    return false
  }
  return at === null ? changedAt > now - SESSION_SECONDS : at < changedAt
}

/** `/store/*`: a token or session from before its identity's password changed is refused (401). */
export async function signInAfterPasswordChange(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const signIn = signInOf(req)
    if (!signIn) {
      next()
      return
    }
    if (!signInOutlived(signIn.at, await passwordChangedAt(req, signIn.identity))) {
      next()
      return
    }
    const session = sessionOf(req)
    if (session?.auth_context && !claimsOf(req)) {
      session.destroy?.(() => undefined)
    }
    rejectRequest(
      req,
      res,
      401,
      { type: "unauthorized", message: "account.token_before_password_change" },
      "sign_in_before_password_change"
    )
  } catch (error) {
    next(error)
  }
}

/** `POST /auth/session`: the session notes when it was opened, for the check above. */
export function noteSessionSignIn(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const session = sessionOf(req)
  if (session) {
    session[SESSION_SIGNED_IN_AT] = Math.floor(Date.now() / 1000)
  }
  next()
}

export const SIGN_IN_EPOCH_ROUTES = [
  { matcher: "/store/*", middlewares: [signInAfterPasswordChange] },
  { matcher: "/auth/session", methods: ["POST" as const], middlewares: [noteSessionSignIn] },
]
