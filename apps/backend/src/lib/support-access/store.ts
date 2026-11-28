import type Redis from "ioredis"
import { registerProcessCache } from "../cache/process-caches"
import { parseEnv } from "../env"
import { createRedisClient, tenantNamespace } from "../redis"

/**
 * Where the shop keeps its support sessions (adr/0061 Ek "Destek erişimi",
 * Karar 3–4): each grant's id claimed once, and each open session's record
 * until it ends, read on every request the session makes. Redis under the
 * tenant's namespace (shared by every process); process memory without
 * Redis (a developer's machine, tests). A Redis error is thrown, never read
 * as "unseen" or "open": the caller refuses (fails closed).
 */

export type SupportEndReason = "logout" | "expired" | "ended_by_owner" | "disabled"

export interface SupportSession {
  grant_id: string
  actor_id: string
  operator: { id: string; name: string; role: "owner" | "operator" }
  reason: string
  /** ISO times. */
  started_at: string
  expires_at: string
  /** Set once it ends before its time; a record past `expires_at` is over anyway. */
  ended_at?: string
  ended_reason?: SupportEndReason
}

export interface SupportStore {
  /** True for the first claim of `grantId` only (`SET NX`), kept `ttlMs`. */
  claimGrant: (grantId: string, ttlMs: number) => Promise<boolean>
  put: (session: SupportSession, ttlMs: number) => Promise<void>
  get: (grantId: string) => Promise<SupportSession | null>
  /** Every record still kept: open ones and those ended but not yet expired. */
  list: () => Promise<SupportSession[]>
}

const parse = (raw: string | null): SupportSession | null => {
  if (raw === null) {
    return null
  }
  try {
    return JSON.parse(raw) as SupportSession
  } catch {
    return null
  }
}

export function createRedisSupportStore(redis: Redis, prefix: string): SupportStore {
  const grant = (id: string) => `${prefix}grant:${id}`
  const session = (id: string) => `${prefix}session:${id}`
  const index = `${prefix}sessions`
  return {
    claimGrant: async (grantId, ttlMs) =>
      (await redis.set(grant(grantId), "1", "PX", Math.max(1, Math.ceil(ttlMs)), "NX")) === "OK",
    put: async (record, ttlMs) => {
      const ttl = Math.max(1, Math.ceil(ttlMs))
      const until = Date.now() + ttl
      await redis
        .multi()
        .set(session(record.grant_id), JSON.stringify(record), "PX", ttl)
        .zadd(index, until, record.grant_id)
        .pexpire(index, ttl)
        .exec()
    },
    get: async (grantId) => parse(await redis.get(session(grantId))),
    list: async () => {
      await redis.zremrangebyscore(index, "-inf", Date.now())
      const ids = await redis.zrange(index, 0, -1)
      if (ids.length === 0) {
        return []
      }
      const rows = await redis.mget(...ids.map(session))
      return rows.map(parse).filter((row): row is SupportSession => row !== null)
    },
  }
}

export function createMemorySupportStore(now: () => number = Date.now): SupportStore {
  const grants = new Map<string, number>()
  const sessions = new Map<string, { record: SupportSession; until: number }>()
  const live = (id: string) => {
    const entry = sessions.get(id)
    if (entry && entry.until <= now()) {
      sessions.delete(id)
      return null
    }
    return entry?.record ?? null
  }
  return {
    claimGrant: (grantId, ttlMs) => {
      const until = grants.get(grantId)
      if (until !== undefined && until > now()) {
        return Promise.resolve(false)
      }
      grants.set(grantId, now() + ttlMs)
      return Promise.resolve(true)
    },
    put: (record, ttlMs) => {
      sessions.set(record.grant_id, { record: { ...record }, until: now() + ttlMs })
      return Promise.resolve()
    },
    get: (grantId) => Promise.resolve(live(grantId)),
    list: () =>
      Promise.resolve(
        [...sessions.keys()]
          .map((id) => live(id))
          .filter((row): row is SupportSession => row !== null)
      ),
  }
}

let shared: SupportStore | undefined
// A store in process memory starts afresh per spec file of a bundled test run
registerProcessCache(() => {
  shared = undefined
})

/** The tenant's store: Redis when configured, else this process's memory. */
export function supportStore(): SupportStore {
  if (shared) {
    return shared
  }
  const env = parseEnv()
  const prefix = `qt:support:${tenantNamespace(env.DATABASE_URL, env.NODE_ENV, process.env["QT_TEST_RUN"])}:`
  shared = env.REDIS_URL
    ? createRedisSupportStore(createRedisClient(env.REDIS_URL, "support_access"), prefix)
    : createMemorySupportStore()
  return shared
}

/** For tests: a store of their own. */
export function useSupportStore(store: SupportStore | undefined): void {
  shared = store
}
