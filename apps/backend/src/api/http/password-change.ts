import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { bearerTokenOf, claimsOf } from "./bearer"
import { rejectRequest } from "./reject"

/**
 * A changed password ends what was signed in before it (F15.1, F14
 * closing review). Medusa refreshes any token (2.21.2, its own note: "we
 * probably want to disallow refreshes if the password changes"): someone
 * who registered with a stranger's address keeps the token that
 * registration gave, and once the stranger has reset the password and
 * confirmed the address, refreshes it into the account. Here the time of
 * the change is kept on the identity, and a token from before it neither
 * refreshes, opens a session nor opens a customer account.
 */

/** Where the identity keeps when its password last changed (app_metadata). */
export const PASSWORD_CHANGED_AT = "password_changed_at"
const KEY = PASSWORD_CHANGED_AT

/** The bearer token's identity and when it was given (seconds). */
function bearerOf(req: MedusaRequest): { identity: string; issued: number } | null {
  const claims = claimsOf(req)
  return typeof claims?.["auth_identity_id"] === "string" && typeof claims["iat"] === "number"
    ? { identity: claims["auth_identity_id"], issued: claims["iat"] }
    : null
}

/**
 * `POST /auth/:actor_type/emailpass/update` (a reset link's new password):
 * once Medusa took it (an answer of 200: the reset token checked), the
 * identity notes when. The token names the login address.
 */
export function notePasswordChange(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const named = claimsOf(req)?.["entity_id"]
  const email =
    (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id ??
    (typeof named === "string" ? named : undefined)
  res.on("finish", () => {
    if (res.statusCode !== 200 || !email) {
      return
    }
    void (async () => {
      const auth = req.scope.resolve(Modules.AUTH)
      const [provider] = await auth.listProviderIdentities(
        { entity_id: email, provider: "emailpass" },
        { take: 1, select: ["auth_identity_id"] }
      )
      if (!provider?.auth_identity_id) {
        return
      }
      const identity = await auth.retrieveAuthIdentity(provider.auth_identity_id)
      await auth.updateAuthIdentities({
        id: identity.id,
        app_metadata: { ...(identity.app_metadata ?? {}), [KEY]: new Date().toISOString() },
      })
    })().catch((error: unknown) => {
      logger.error({ event: "auth.password_change_not_noted", err: errorSummary(error) })
    })
  })
  next()
}

/**
 * A token given before its identity's password changed is refused where
 * it would be renewed or turned into an account (refresh, session,
 * `POST /store/customers`). Seconds are compared: a token of the same
 * second as the change is the new sign-in's.
 */
export async function tokenAfterPasswordChange(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const bearer = bearerOf(req)
    if (!bearer) {
      // A bearer token we cannot read is one Medusa will refuse too: refused here first
      if (bearerTokenOf(req)) {
        rejectRequest(
          req,
          res,
          401,
          { type: "unauthorized", message: "account.session_invalid" },
          "token_unreadable"
        )
        return
      }
      next()
      return
    }
    const identity = await req.scope
      .resolve(Modules.AUTH)
      .retrieveAuthIdentity(bearer.identity)
      .catch(() => null)
    const changed = identity?.app_metadata?.[KEY]
    const at = typeof changed === "string" ? Math.floor(new Date(changed).getTime() / 1000) : NaN
    if (Number.isFinite(at) && bearer.issued < at) {
      rejectRequest(
        req,
        res,
        401,
        { type: "unauthorized", message: "account.token_before_password_change" },
        "token_before_password_change"
      )
      return
    }
    next()
  } catch (error) {
    next(error)
  }
}
