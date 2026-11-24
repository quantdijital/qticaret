import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { conversationStore } from "../../lib/ai/assistant/conversation"
import { errorSummary, logger } from "../../lib/logging"
import { staffAccountStore } from "../../lib/staff/account-store"
import type { AccountStore } from "../../lib/staff/account-store"
import { SESSION_SIGNED_IN_AT } from "./sign-in-epoch"

/**
 * A staff member's panel sessions (the owner, 2026-11-06; security review
 * 2026-11-06). Each one's id is noted at sign-in (`POST /auth/session`)
 * beside the user, so listing and ending them reads only theirs, never
 * the session store as a whole (customers' sessions live there too). Each
 * noted id is checked against the store: one ended elsewhere drops out.
 * A session holds who signed in, not where or when.
 */

interface StoredSession {
  auth_context?: { actor_type?: unknown; actor_id?: unknown } | null
  cookie?: { originalMaxAge?: unknown } | null
}

interface SessionStoreLike {
  get: (sid: string, callback: (error: unknown, session?: StoredSession | null) => void) => void
  destroy: (sid: string, callback: (error?: unknown) => void) => void
}

interface SessionRequest {
  sessionStore?: SessionStoreLike
  sessionID?: string
  session?:
    | (StoredSession & {
        regenerate?: (callback: (error?: unknown) => void) => void
        save?: (callback: (error?: unknown) => void) => void
      })
    | null
}

// Medusa's session lifetime as medusa-config states it, when the cookie does not say
const SESSION_MS = 10 * 60 * 60 * 1000

const asSession = (req: MedusaRequest) => req as unknown as SessionRequest

const staffOf = (session: StoredSession | null | undefined): string | null =>
  session?.auth_context?.actor_type === "user" && typeof session.auth_context.actor_id === "string"
    ? session.auth_context.actor_id
    : null

function lifetimeOf(session: StoredSession | null | undefined): number {
  const age = session?.cookie?.originalMaxAge
  return typeof age === "number" && age > 0 ? age : SESSION_MS
}

function read(store: SessionStoreLike, sid: string): Promise<StoredSession | null> {
  return new Promise((resolve, reject) => {
    store.get(sid, (error, session) => {
      if (error) {
        reject(error instanceof Error ? error : new Error("session_store"))
      } else {
        resolve(session ?? null)
      }
    })
  })
}

function destroy(store: SessionStoreLike, sid: string): Promise<boolean> {
  return new Promise((resolve) => {
    store.destroy(sid, (error) => {
      if (error) {
        logger.warn({ event: "staff.session_end_failed", err: errorSummary(error) })
      }
      resolve(!error)
    })
  })
}

/** Notes the session a staff member opens, once Medusa answers 200; the session's own lifetime. */
export function noteSessionStart(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  res.on("finish", () => {
    const { session, sessionID } = asSession(req)
    const userId = staffOf(session)
    if (res.statusCode !== 200 || !userId || !sessionID) {
      return
    }
    staffAccountStore()
      .addSession(userId, sessionID, lifetimeOf(session))
      .catch((error: unknown) => {
        logger.warn({ event: "staff.session_note_failed", err: errorSummary(error) })
      })
  })
  next()
}

/** A sign-out drops the session's note (read before Medusa destroys it). */
export function noteSessionEnd(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const { session, sessionID } = asSession(req)
  const userId = staffOf(session)
  if (userId && sessionID) {
    staffAccountStore()
      .removeSessions(userId, [sessionID])
      .catch((error: unknown) => {
        logger.warn({ event: "staff.session_note_failed", err: errorSummary(error) })
      })
  }
  if (userId) {
    // adr/0079 §6: signing out drops the person's assistant conversations at once
    conversationStore()
      .removeUser(userId)
      .catch((error: unknown) => {
        logger.warn({ event: "ai.assistant_conversations_drop_failed", err: errorSummary(error) })
      })
  }
  next()
}

/**
 * The ids of the user's open sessions, or null when they cannot be read.
 * A noted id whose session ended, or now holds someone else, is dropped.
 */
export async function sessionIdsOf(
  req: MedusaRequest,
  userId: string,
  store: AccountStore = staffAccountStore()
): Promise<string[] | null> {
  const sessions = asSession(req).sessionStore
  if (!sessions) {
    return null
  }
  try {
    const noted = await store.sessionIds(userId)
    const found = await Promise.all(
      noted.map(async (sid) => (staffOf(await read(sessions, sid)) === userId ? sid : null))
    )
    const open = found.filter((sid): sid is string => sid !== null)
    await store.removeSessions(
      userId,
      noted.filter((sid) => !open.includes(sid))
    )
    return open
  } catch (error) {
    logger.warn({ event: "staff.sessions_unreadable", err: errorSummary(error) })
    return null
  }
}

/**
 * Whether panel session `sid` is still open and signed in as `userId`
 * (adr/0065: the theme editor's live preview ends with the panel session
 * it was opened from: a sign-out, a password change, "end other
 * sessions"). False when the store cannot say.
 */
export async function sessionHolds(
  req: MedusaRequest,
  sid: string,
  userId: string
): Promise<boolean> {
  const sessions = asSession(req).sessionStore
  if (!sessions || !sid) {
    return false
  }
  try {
    return staffOf(await read(sessions, sid)) === userId
  } catch (error) {
    logger.warn({ event: "staff.sessions_unreadable", err: errorSummary(error) })
    return false
  }
}

/**
 * The panel session making the request and who it is signed in as; null
 * for a bearer request, and for one carrying any credential beside its
 * session cookie (a bearer token, a secret API key: two identities, Medusa
 * reads the session's and the other may name someone else; security
 * review 2026-11-15).
 */
export function currentStaffSession(req: MedusaRequest): { sid: string; userId: string } | null {
  if (req.headers.authorization?.trim()) {
    return null
  }
  const { session, sessionID } = asSession(req)
  const userId = staffOf(session)
  return userId && sessionID ? { sid: sessionID, userId } : null
}

/** How many sessions the user has open, this one counted; null when unknown. */
export async function openSessionCount(
  req: MedusaRequest,
  userId: string,
  store?: AccountStore
): Promise<number | null> {
  return (await sessionIdsOf(req, userId, store))?.length ?? null
}

/**
 * Ends the user's sessions but the one making the request (a bearer
 * request has none of its own: all of them end). Returns how many ended;
 * a failure is logged, never thrown, as the change itself has been made.
 */
export async function endOtherSessions(
  req: MedusaRequest,
  userId: string,
  store: AccountStore = staffAccountStore()
): Promise<number> {
  const sessions = asSession(req).sessionStore
  const ids = await sessionIdsOf(req, userId, store)
  if (!sessions || !ids) {
    return 0
  }
  const current = asSession(req).sessionID
  const others = ids.filter((id) => id !== current)
  const ended = await Promise.all(others.map((sid) => destroy(sessions, sid)))
  await store
    .removeSessions(
      userId,
      others.filter((_, index) => ended[index])
    )
    .catch(() => undefined)
  return ended.filter(Boolean).length
}

/**
 * A new id for the session asking, its sign-in kept (after a password
 * change: an id seen before it opens nothing). The old id's note goes,
 * the new one's comes. Nothing to do for a bearer request.
 */
export async function renewSession(
  req: MedusaRequest,
  userId: string,
  store: AccountStore = staffAccountStore()
): Promise<void> {
  const { session, sessionID: before } = asSession(req)
  if (!session?.regenerate || staffOf(session) !== userId || !before) {
    return
  }
  const kept = session.auth_context
  try {
    await new Promise<void>((resolve, reject) => {
      session.regenerate?.((error) => {
        if (error) {
          reject(error instanceof Error ? error : new Error("session_regenerate"))
        } else {
          resolve()
        }
      })
    })
    // `regenerate` puts a new session on the request
    const renewed = asSession(req)
    if (renewed.session) {
      renewed.session.auth_context = kept ?? null
      // The renewed session is a sign-in after the change: noted, as `POST /auth/session` notes one
      ;(renewed.session as Record<string, unknown>)[SESSION_SIGNED_IN_AT] = Math.floor(
        Date.now() / 1000
      )
      await new Promise<void>((resolve, reject) => {
        renewed.session?.save?.((error) => {
          if (error) {
            reject(error instanceof Error ? error : new Error("session_save"))
          } else {
            resolve()
          }
        })
      })
    }
    await store.removeSessions(userId, [before])
    if (renewed.sessionID) {
      await store.addSession(userId, renewed.sessionID, lifetimeOf(renewed.session))
    }
  } catch (error) {
    logger.warn({ event: "staff.session_renew_failed", err: errorSummary(error) })
  }
}
