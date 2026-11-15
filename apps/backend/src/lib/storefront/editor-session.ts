import { randomBytes } from "node:crypto"
import type Redis from "ioredis"
import { previewSigner } from "../content/preview-token"
import { parseEnv } from "../env"
import { createRedisClient, tenantNamespace } from "../redis"

/**
 * The theme editor's live preview session (adr/0065 §1, Faz 1): one stable
 * address for the preview frame while the editor is open, so a save, a
 * page change or a sample change redraws the frame in place instead of
 * loading a new signed link (`sfl_`, kept for "open in a new tab" and for
 * sharing: frozen at its save, adr/0065 karar 6).
 *
 * The token is `sfs_<128 random bits, hex>.<end>.<mac>`: the MAC under its
 * own context (`layout-session:v1`, so neither a design link nor any other
 * kind opens it) binds the id, the end (12 hours at most) and the moment
 * the session was opened. It opens only while its record is kept under
 * the tenant's namespace: who opened it, from which panel session, when,
 * and when the panel last said it is still open. Idle for 30 minutes the
 * record lapses; the panel renews it every few minutes while open, and
 * drops it when the editor closes. The token only reads the last saved
 * draft; it writes nothing. Without Redis (a developer's machine) the
 * records live in this process.
 */

export const SESSION_PREFIX = "sfs_"
export const SESSION_IDLE_MS = 30 * 60 * 1000
export const SESSION_MAX_HOURS = 12
const SESSION_MAX_MS = SESSION_MAX_HOURS * 60 * 60 * 1000

/** A session's id: the prefix and 128 random bits in hex. */
export const SESSION_ID = /^sfs_[0-9a-f]{32}$/

const signer = previewSigner("layout-session:v1", "sfs_[0-9a-f]{32}", SESSION_MAX_HOURS)

export interface EditorSessionRecord {
  user_id: string
  /** The panel session it was opened from: ending that one ends this. */
  sid: string
  /** Epoch ms. */
  created_at: number
  /** Epoch ms: the panel's last word that the editor is open. */
  last_seen: number
}

export interface EditorSessionStore {
  put: (id: string, record: EditorSessionRecord, ttlMs: number) => Promise<void>
  get: (id: string) => Promise<EditorSessionRecord | null>
  remove: (id: string) => Promise<void>
}

/** A record read back, or null for anything not shaped like one. */
function recordOf(text: string | null): EditorSessionRecord | null {
  if (!text) {
    return null
  }
  try {
    const value = JSON.parse(text) as Partial<EditorSessionRecord>
    return typeof value.user_id === "string" &&
      typeof value.sid === "string" &&
      typeof value.created_at === "number" &&
      typeof value.last_seen === "number"
      ? (value as EditorSessionRecord)
      : null
  } catch {
    return null
  }
}

export function createRedisSessionStore(redis: Redis, prefix: string): EditorSessionStore {
  const key = (id: string) => `${prefix}${id}`
  return {
    put: async (id, record, ttlMs) => {
      await redis.set(key(id), JSON.stringify(record), "PX", Math.max(1, Math.floor(ttlMs)))
    },
    get: async (id) => recordOf(await redis.get(key(id))),
    remove: async (id) => {
      await redis.del(key(id))
    },
  }
}

export function createMemorySessionStore(now: () => number = Date.now): EditorSessionStore {
  const records = new Map<string, { text: string; until: number }>()
  return {
    put: (id, record, ttlMs) => {
      records.set(id, { text: JSON.stringify(record), until: now() + ttlMs })
      return Promise.resolve()
    },
    get: (id) => {
      const entry = records.get(id)
      if (entry && entry.until <= now()) {
        records.delete(id)
      }
      return Promise.resolve(recordOf(records.get(id)?.text ?? null))
    },
    remove: (id) => {
      records.delete(id)
      return Promise.resolve()
    },
  }
}

let shared: EditorSessionStore | undefined

/** The tenant's store: Redis when configured, else this process's memory. */
export function editorSessionStore(): EditorSessionStore {
  if (shared) {
    return shared
  }
  const env = parseEnv()
  const prefix = `qt:sfs:${tenantNamespace(env.DATABASE_URL, env.NODE_ENV, process.env["QT_TEST_RUN"])}:`
  shared = env.REDIS_URL
    ? createRedisSessionStore(createRedisClient(env.REDIS_URL, "editor_session"), prefix)
    : createMemorySessionStore()
  return shared
}

/** How long a record is kept from `now`: idle time, never past the session's end. */
const ttlOf = (record: EditorSessionRecord, now: number) =>
  Math.min(SESSION_IDLE_MS, record.created_at + SESSION_MAX_MS - now)

export interface OpenedSession {
  id: string
  token: string
  expires_at: Date
}

/** A new session for the staff member signed in on panel session `sid`. */
export async function openEditorSession(
  store: EditorSessionStore,
  key: Buffer,
  owner: { userId: string; sid: string },
  now = new Date()
): Promise<OpenedSession> {
  const id = `${SESSION_PREFIX}${randomBytes(16).toString("hex")}`
  const at = now.getTime()
  const record: EditorSessionRecord = {
    user_id: owner.userId,
    sid: owner.sid,
    created_at: at,
    last_seen: at,
  }
  await store.put(id, record, ttlOf(record, at))
  const { token, expires_at } = signer.token(key, { id, updated_at: at }, now)
  return { id, token, expires_at }
}

/** The session's record when it is `userId`'s and still open; null otherwise. */
async function ownRecord(
  store: EditorSessionStore,
  id: string,
  userId: string,
  now: number
): Promise<EditorSessionRecord | null> {
  if (!SESSION_ID.test(id)) {
    return null
  }
  const record = await store.get(id)
  if (record?.user_id !== userId) {
    return null
  }
  return now - record.last_seen < SESSION_IDLE_MS && now - record.created_at < SESSION_MAX_MS
    ? record
    : null
}

/** Keeps `userId`'s open session going; false when it is not theirs or has ended. */
export async function renewEditorSession(
  store: EditorSessionStore,
  id: string,
  userId: string,
  now = new Date()
): Promise<boolean> {
  const at = now.getTime()
  const record = await ownRecord(store, id, userId, at)
  if (!record) {
    return false
  }
  const renewed = { ...record, last_seen: at }
  await store.put(id, renewed, ttlOf(renewed, at))
  return true
}

/** Ends `userId`'s session; false when there was none of theirs to end. */
export async function closeEditorSession(
  store: EditorSessionStore,
  id: string,
  userId: string,
  now = new Date()
): Promise<boolean> {
  const record = await ownRecord(store, id, userId, now.getTime())
  if (!record) {
    return false
  }
  await store.remove(id)
  return true
}

/**
 * The record a token opens: well formed, before its end, signed for a
 * session still kept and opened when its record says, not idle. Null for
 * anything else; the caller answers 404 either way. Who holds the record
 * (their panel session, their role) is checked by the caller.
 */
export async function editorSessionOf(
  store: EditorSessionStore,
  key: Buffer,
  token: string,
  now = new Date()
): Promise<EditorSessionRecord | null> {
  const parts = signer.parts(token, now)
  if (!parts) {
    return null
  }
  const record = await store.get(parts.entryId)
  if (!record || !signer.opens(key, parts, record.created_at)) {
    return null
  }
  const at = now.getTime()
  return at - record.last_seen < SESSION_IDLE_MS && at - record.created_at < SESSION_MAX_MS
    ? record
    : null
}
