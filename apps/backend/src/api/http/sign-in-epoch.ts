import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
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
 * never reaches wholesale prices.
 *
 * Every sign-in the request carries is weighed, not only the one Medusa
 * would read first (security review H1: Medusa takes the session before
 * the bearer, so an old cookie beside any bearer must still be refused).
 * A session is read from the server's own store; a bearer's claims are
 * read unverified, which can only refuse: Medusa checks its signature.
 * An outlived session is destroyed.
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

/**
 * When the identity's password last changed (seconds), or null for never.
 * A read that fails is not held (review INFO): the next request reads
 * again; this one is let through, as a refusal would close the Store to
 * every signed-in shopper while the database is unreachable.
 */
async function passwordChangedAt(req: MedusaRequest, identityId: string): Promise<number | null> {
  const held = heldPasswordChange(identityId)
  if (held !== undefined) {
    return held
  }
  let identity: { app_metadata?: Record<string, unknown> | null } | null
  try {
    identity = await req.scope.resolve(Modules.AUTH).retrieveAuthIdentity(identityId)
  } catch (error) {
    logger.warn({ event: "auth.sign_in_epoch_unread", err: errorSummary(error) })
    return null
  }
  const changed = identity.app_metadata?.[PASSWORD_CHANGED_AT]
  const seconds = typeof changed === "string" ? Math.floor(new Date(changed).getTime() / 1000) : NaN
  const at = Number.isFinite(seconds) ? seconds : null
  holdPasswordChange(identityId, at)
  return at
}

export interface SignIn {
  kind: "session" | "bearer"
  identity: string
  /** When it was made (seconds); null for a session opened before this was noted. */
  at: number | null
}

/** Every sign-in the request carries: its session's and its bearer's, each with its time. */
export function signInsOf(req: MedusaRequest): SignIn[] {
  const found: SignIn[] = []
  const session = sessionOf(req)
  const sessionIdentity = session?.auth_context?.auth_identity_id
  if (typeof sessionIdentity === "string") {
    const at = session?.[SESSION_SIGNED_IN_AT]
    found.push({
      kind: "session",
      identity: sessionIdentity,
      at: typeof at === "number" ? at : null,
    })
  }
  const claims = claimsOf(req)
  if (typeof claims?.["auth_identity_id"] === "string") {
    const issued = claims["iat"]
    found.push({
      kind: "bearer",
      identity: claims["auth_identity_id"],
      at: typeof issued === "number" ? issued : 0,
    })
  }
  return found
}

/**
 * Whether a sign-in made at `at` is older than the password: a session
 * from before this note was kept (`at` null) counts as older while the
 * change is younger than a session can live. (A session whose lifetime
 * slides with use could outlive that; one opened before this note and
 * kept alive past ten hours of a change would pass. Such sessions are
 * from before this rule's deploy only.)
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
    const outlived: SignIn[] = []
    for (const signIn of signInsOf(req)) {
      if (signInOutlived(signIn.at, await passwordChangedAt(req, signIn.identity))) {
        outlived.push(signIn)
      }
    }
    if (outlived.length === 0) {
      next()
      return
    }
    if (outlived.some((signIn) => signIn.kind === "session")) {
      sessionOf(req)?.destroy?.(() => undefined)
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
