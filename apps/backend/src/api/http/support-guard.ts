import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { errorSummary, logger } from "../../lib/logging"
import { decideSupport } from "../../lib/support-access/permissions"
import { grantIdOfActor, isSupportActor, sessionState } from "../../lib/support-access/session"
import { supportStore } from "../../lib/support-access/store"
import type { SupportSession } from "../../lib/support-access/store"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SecuritySettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { endSupportSessionWorkflow } from "../../workflows/support-access"
import { claimsOf } from "./bearer"
import { auditContext } from "./audit/context"
import { rejectRequest } from "./reject"
import { routePath } from "./request-path"

/**
 * A "Platform desteği" session on every request it makes (adr/0061 Ek
 * "Destek erişimi", Karar 4–5). Its identity, not its carrier, decides:
 * any request whose actor is `qtsup_…` (a session's, or a bearer token's
 * however one was made) is held to the session's record. The record must
 * be there, not ended, not past its time, and the owner's switch on; else
 * the browser's session is destroyed and the answer is 401
 * `support.session_ended`. An open session then reaches what
 * `decideSupport` allows (403 `support.forbidden` otherwise). The store
 * failing refuses (fails closed).
 */

interface SessionLike {
  auth_context?: { actor_id?: unknown; actor_type?: unknown } | null
  destroy?: (callback: (error?: unknown) => void) => void
}

const sessionOf = (req: MedusaRequest) =>
  (req as unknown as { session?: SessionLike | null }).session ?? null

/** The support actor a request carries: Medusa's own reading, else its session's or bearer's. */
export function supportActorOfRequest(req: MedusaRequest): string | null {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  if (auth?.actor_type === "user" && isSupportActor(auth.actor_id)) {
    return auth.actor_id
  }
  const fromSession = sessionOf(req)?.auth_context?.actor_id
  if (isSupportActor(fromSession)) {
    return fromSession as string
  }
  const fromBearer = claimsOf(req)?.["actor_id"]
  return isSupportActor(fromBearer) ? (fromBearer as string) : null
}

export async function supportEnabled(req: MedusaRequest): Promise<boolean> {
  const security = (await req.scope
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("security")) as unknown as SecuritySettings
  return security.support_access_enabled
}

const SUPPORT_SESSION = Symbol.for("qt.support_session")

/** The open session the guard read for this request; null for anyone else. */
export const openSupportSessionOf = (req: MedusaRequest): SupportSession | null =>
  (req as unknown as Record<symbol, SupportSession | undefined>)[SUPPORT_SESSION] ?? null

function destroySession(req: MedusaRequest): void {
  sessionOf(req)?.destroy?.(() => undefined)
}

const ended = (req: MedusaRequest, res: MedusaResponse) => {
  destroySession(req)
  rejectRequest(
    req,
    res,
    401,
    { type: "unauthorized", message: "support.session_ended" },
    "support_session_ended"
  )
}

/** The session's record, if it is still open; ends a session the switch closed. */
async function openSession(req: MedusaRequest, actorId: string): Promise<SupportSession | null> {
  const grantId = grantIdOfActor(actorId)
  const session = await supportStore().get(grantId)
  const state = sessionState(session, { now: Date.now(), enabled: await supportEnabled(req) })
  if (state === "open") {
    return session
  }
  if (state === "disabled") {
    await endSupportSessionWorkflow(req.scope)
      .run({
        input: { grant_id: grantId, reason: "disabled", actor_id: null, facts: factsOf(req) },
      })
      .catch((error: unknown) => {
        logger.warn({ event: "support_access.end_failed", err: errorSummary(error) })
      })
  }
  return null
}

export const factsOf = (req: MedusaRequest) => {
  const { request_id, ip, user_agent } = auditContext(req)
  return { request_id: request_id ?? null, ip: ip ?? null, user_agent: user_agent ?? null }
}

/**
 * For `/admin/*` (from the role layer, `guardStaffRoles`) and `/auth/*`:
 * true when the request is a support session's and has been answered or
 * passed on here; false when it is anyone else's.
 */
export async function guardSupportRequest(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<boolean> {
  const actorId = supportActorOfRequest(req)
  if (actorId === null) {
    return false
  }
  let session: SupportSession | null
  try {
    session = await openSession(req, actorId)
  } catch (error) {
    logger.warn({ event: "support_access.store_unreadable", err: errorSummary(error) })
    rejectRequest(
      req,
      res,
      503,
      { type: "unexpected_state", message: "support.unavailable" },
      "support_store_unreadable"
    )
    return true
  }
  if (session?.actor_id !== actorId) {
    ended(req, res)
    return true
  }
  const body = req.body as { type?: unknown } | undefined
  const decision = decideSupport(req.method, routePath(req), {
    jobType: typeof body?.type === "string" ? body.type : undefined,
  })
  if (!decision.allowed) {
    rejectRequest(
      req,
      res,
      403,
      { type: "not_allowed", message: "support.forbidden" },
      "support_forbidden"
    )
    return true
  }
  ;(req as unknown as Record<symbol, SupportSession>)[SUPPORT_SESSION] = session
  next()
  return true
}

/**
 * `/auth/*`: a support session reaches signing out only (no token from it,
 * no 2FA, password or address change). Signing out ends the session's
 * record before Medusa destroys the browser's session.
 */
export async function guardSupportAuth(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  try {
    const actorId = supportActorOfRequest(req)
    const signingOut = req.method.toUpperCase() === "DELETE" && routePath(req) === "/auth/session"
    if (actorId !== null && signingOut) {
      await endSupportSessionWorkflow(req.scope)
        .run({
          input: {
            grant_id: grantIdOfActor(actorId),
            reason: "logout",
            actor_id: actorId,
            facts: factsOf(req),
          },
        })
        .catch((error: unknown) => {
          logger.warn({ event: "support_access.end_failed", err: errorSummary(error) })
        })
      next()
      return
    }
    // A new support session may be asked for over an old one: the route renews the session
    if (routePath(req) === "/auth/support-access") {
      next()
      return
    }
    if (!(await guardSupportRequest(req, res, next))) {
      next()
    }
  } catch (error) {
    next(error)
  }
}

export const SUPPORT_AUTH_ROUTES = [{ matcher: "/auth/*", middlewares: [guardSupportAuth] }]
