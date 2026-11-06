import type { MedusaRequest } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../lib/logging"

/**
 * A staff member's open panel sessions (the owner, 2026-11-06), read from
 * the session store Medusa already keeps (express-session: Redis, or memory
 * without it). Nothing new is tracked: a session holds who signed in, not
 * where or when. A changed password ends the others; the one asking stays.
 */

interface StoredSession {
  id?: string
  auth_context?: { actor_type?: unknown; actor_id?: unknown } | null
}

type Listed = StoredSession[] | Record<string, StoredSession> | null | undefined

interface SessionStoreLike {
  all?: (callback: (error: unknown, sessions?: Listed) => void) => void
  destroy: (sid: string, callback: (error?: unknown) => void) => void
}

// A shop's panel sessions are a handful; a store holding far more is read this far
const MAX_SESSIONS = 5000

const storeOf = (req: MedusaRequest) =>
  (req as unknown as { sessionStore?: SessionStoreLike }).sessionStore

const currentSid = (req: MedusaRequest) => (req as unknown as { sessionID?: string }).sessionID

/** Every stored session as [id, session]: connect-redis lists them, memory maps them. */
function entriesOf(listed: Listed): [string, StoredSession][] {
  if (Array.isArray(listed)) {
    return listed.flatMap((each) => (typeof each.id === "string" ? [[each.id, each] as const] : []))
  }
  return Object.entries(listed ?? {})
}

/**
 * The ids of the user's sessions, or null when the store cannot list them.
 * Sessions of other people and of customers are never touched.
 */
export async function sessionIdsOf(req: MedusaRequest, userId: string): Promise<string[] | null> {
  const store = storeOf(req)
  const all = store?.all
  if (!store || !all) {
    return null
  }
  try {
    const listed = await new Promise<Listed>((resolve, reject) => {
      all.call(store, (error, sessions) => {
        if (error) {
          reject(error instanceof Error ? error : new Error("session_store"))
        } else {
          resolve(sessions)
        }
      })
    })
    return entriesOf(listed)
      .slice(0, MAX_SESSIONS)
      .filter(
        ([, session]) =>
          session.auth_context?.actor_type === "user" && session.auth_context.actor_id === userId
      )
      .map(([id]) => id)
  } catch (error) {
    logger.warn({ event: "staff.sessions_unreadable", err: errorSummary(error) })
    return null
  }
}

/** How many sessions the user has open, this one counted; null when unknown. */
export async function openSessionCount(req: MedusaRequest, userId: string): Promise<number | null> {
  return (await sessionIdsOf(req, userId))?.length ?? null
}

/**
 * Ends the user's sessions but the one making the request (a bearer
 * request has none of its own: all of them end). Returns how many ended;
 * a failure is logged, never thrown, as the change itself has been made.
 */
export async function endOtherSessions(req: MedusaRequest, userId: string): Promise<number> {
  const store = storeOf(req)
  const ids = await sessionIdsOf(req, userId)
  if (!store || !ids) {
    return 0
  }
  const current = currentSid(req)
  const others = ids.filter((id) => id !== current)
  const ended = await Promise.all(
    others.map(
      (id) =>
        new Promise<boolean>((resolve) => {
          store.destroy(id, (error) => {
            if (error) {
              logger.warn({ event: "staff.session_end_failed", err: errorSummary(error) })
            }
            resolve(!error)
          })
        })
    )
  )
  return ended.filter(Boolean).length
}
