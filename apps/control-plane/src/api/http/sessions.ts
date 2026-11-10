import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary } from "@qticaret/server-kit"
import { sessionIndex } from "../../lib/staff/session-index"
import { keyed } from "./caller"
import { loggerOf } from "./request"

/**
 * Platform staff sessions (the shop's staff-sessions, copied): each id is
 * noted at sign-in (`POST /auth/session`), so listing and ending a member's
 * sessions reads only theirs. A noted id is checked against the session
 * store: one ended elsewhere drops out. A session is shown by a keyed hash
 * of its id, never the id itself.
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
  session?: StoredSession | null
}

// medusa-config's session lifetime, when the cookie does not say
const SESSION_MS = 8 * 60 * 60 * 1000

const asSession = (req: MedusaRequest) => req as unknown as SessionRequest

const staffOf = (session: StoredSession | null | undefined): string | null =>
  session?.auth_context?.actor_type === "user" && typeof session.auth_context.actor_id === "string"
    ? session.auth_context.actor_id
    : null

function lifetimeOf(session: StoredSession | null | undefined): number {
  const age = session?.cookie?.originalMaxAge
  return typeof age === "number" && age > 0 ? age : SESSION_MS
}

const index = (req: MedusaRequest) =>
  sessionIndex((error) => {
    loggerOf(req)?.error(`cp.session_index_redis ${JSON.stringify({ err: errorSummary(error) })}`)
  })

const warn = (req: MedusaRequest, event: string, error: unknown) => {
  loggerOf(req)?.warn(`${event} ${JSON.stringify({ err: errorSummary(error) })}`)
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
      resolve(!error)
    })
  })
}

/** A session's public handle: a keyed hash of its id. */
export const sessionHandle = (sid: string): string => keyed("cp_session", sid, 24)

/**
 * Notes the session a staff member opens before Medusa's answer goes (the
 * index is what makes a session count, Ek C4). A note that cannot be
 * written fails closed (L7): the session's sign-in is taken off it before
 * it is saved, and the failure logged by event for alerting.
 */
export function noteSessionStart(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const end = res.end.bind(res) as (...args: unknown[]) => MedusaResponse
  res.end = ((...args: unknown[]) => {
    const { session, sessionID } = asSession(req)
    const userId = staffOf(session)
    if (res.statusCode !== 200 || !userId || !sessionID || !session) {
      return end(...args)
    }
    index(req)
      .add(userId, sessionID, lifetimeOf(session))
      .catch((error: unknown) => {
        session.auth_context = null
        loggerOf(req)?.error(
          `cp.session_note_failed ${JSON.stringify({ err: errorSummary(error) })}`
        )
      })
      .finally(() => end(...args))
    return res
  }) as MedusaResponse["end"]
  next()
}

/** A sign-out drops the session's note (read before Medusa destroys it). */
export function noteSessionEnd(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const { session, sessionID } = asSession(req)
  const userId = staffOf(session)
  if (userId && sessionID) {
    index(req)
      .remove(userId, [sessionID])
      .catch((error: unknown) => {
        warn(req, "cp.session_note_failed", error)
      })
  }
  next()
}

export interface OpenSession {
  sid: string
  handle: string
  expiresAt: number
  current: boolean
}

/** The user's open sessions; a noted id whose session ended, or holds someone else, drops. */
export async function openSessions(req: MedusaRequest, userId: string): Promise<OpenSession[]> {
  const { sessionStore, sessionID } = asSession(req)
  if (!sessionStore) {
    return []
  }
  const noted = await index(req).list(userId)
  const found = await Promise.all(
    noted.map(async (each) =>
      staffOf(await read(sessionStore, each.sid).catch(() => null)) === userId ? each : null
    )
  )
  const open = found.filter((each): each is { sid: string; expiresAt: number } => each !== null)
  await index(req).remove(
    userId,
    noted.filter((each) => !open.includes(each)).map((each) => each.sid)
  )
  return open.map(({ sid, expiresAt }) => ({
    sid,
    handle: sessionHandle(sid),
    expiresAt,
    current: sid === sessionID && staffOf(asSession(req).session) === userId,
  }))
}

/**
 * Ends the given sessions of the user; how many. The index forgets them
 * first (that alone ends them, Ek C4), then the store destroys them.
 */
export async function endSessions(
  req: MedusaRequest,
  userId: string,
  sids: readonly string[]
): Promise<number> {
  if (sids.length === 0) {
    return 0
  }
  await index(req).remove(userId, sids)
  const { sessionStore } = asSession(req)
  if (sessionStore) {
    await Promise.all(sids.map((sid) => destroy(sessionStore, sid)))
  }
  return sids.length
}

/**
 * Ends every session of the user (2FA changed or reset, deactivated), this
 * one kept when asked; how many ended.
 */
export async function endAllSessions(
  req: MedusaRequest,
  userId: string,
  options: { keepCurrent?: boolean } = {}
): Promise<number> {
  const { sessionID } = asSession(req)
  const noted = (await index(req).list(userId)).map((each) => each.sid)
  const ending = options.keepCurrent ? noted.filter((sid) => sid !== sessionID) : noted
  return endSessions(req, userId, ending)
}
