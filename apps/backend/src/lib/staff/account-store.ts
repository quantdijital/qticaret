import type Redis from "ioredis"
import { parseEnv } from "../env"
import { createRedisClient, tenantNamespace } from "../redis"

/**
 * What a staff member's own account keeps for a while, outside the
 * database (security review 2026-11-06):
 * - the one address change waiting for its link (the latest ask wins; a
 *   confirmation or a cancel takes it, once, atomically);
 * - the ids of their panel sessions, noted at sign-in, so listing and
 *   ending them never reads the whole session store, customers' included.
 * Redis under the tenant's namespace; process memory without Redis.
 */
export interface AccountStore {
  setPending: (userId: string, value: string, ttlMs: number) => Promise<void>
  getPending: (userId: string) => Promise<string | null>
  /** Removes the waiting change if it is still `value`; true when this call took it. */
  takePending: (userId: string, value: string) => Promise<boolean>
  clearPending: (userId: string) => Promise<void>
  addSession: (userId: string, sid: string, ttlMs: number) => Promise<void>
  /** The noted ids not yet past their lifetime. */
  sessionIds: (userId: string) => Promise<string[]>
  removeSessions: (userId: string, sids: readonly string[]) => Promise<void>
}

// The latest value only: a confirmation that read an older one takes nothing
const TAKE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`

type TakingRedis = Redis & { takeIfSame: (key: string, value: string) => Promise<number> }

export function createRedisAccountStore(client: Redis, prefix: string): AccountStore {
  const redis = client as TakingRedis
  redis.defineCommand("takeIfSame", { numberOfKeys: 1, lua: TAKE_SCRIPT })
  const pending = (userId: string) => `${prefix}email-change:${userId}`
  const sessions = (userId: string) => `${prefix}sessions:${userId}`
  return {
    setPending: async (userId, value, ttlMs) => {
      await redis.set(pending(userId), value, "PX", ttlMs)
    },
    getPending: (userId) => redis.get(pending(userId)),
    takePending: async (userId, value) => (await redis.takeIfSame(pending(userId), value)) === 1,
    clearPending: async (userId) => {
      await redis.del(pending(userId))
    },
    addSession: async (userId, sid, ttlMs) => {
      const key = sessions(userId)
      const until = Date.now() + ttlMs
      await redis.multi().zadd(key, until, sid).pexpire(key, ttlMs).exec()
    },
    sessionIds: async (userId) => {
      const key = sessions(userId)
      await redis.zremrangebyscore(key, "-inf", Date.now())
      return redis.zrange(key, 0, -1)
    },
    removeSessions: async (userId, sids) => {
      if (sids.length > 0) {
        await redis.zrem(sessions(userId), ...sids)
      }
    },
  }
}

export function createMemoryAccountStore(now: () => number = Date.now): AccountStore {
  const pending = new Map<string, { value: string; until: number }>()
  const sessions = new Map<string, Map<string, number>>()
  const live = (userId: string) => {
    const entry = pending.get(userId)
    if (entry && entry.until <= now()) {
      pending.delete(userId)
      return null
    }
    return entry?.value ?? null
  }
  return {
    setPending: (userId, value, ttlMs) => {
      pending.set(userId, { value, until: now() + ttlMs })
      return Promise.resolve()
    },
    getPending: (userId) => Promise.resolve(live(userId)),
    takePending: (userId, value) => {
      const taken = live(userId) === value
      if (taken) {
        pending.delete(userId)
      }
      return Promise.resolve(taken)
    },
    clearPending: (userId) => {
      pending.delete(userId)
      return Promise.resolve()
    },
    addSession: (userId, sid, ttlMs) => {
      const mine = sessions.get(userId) ?? new Map<string, number>()
      mine.set(sid, now() + ttlMs)
      sessions.set(userId, mine)
      return Promise.resolve()
    },
    sessionIds: (userId) => {
      const mine = sessions.get(userId) ?? new Map<string, number>()
      for (const [sid, until] of mine) {
        if (until <= now()) {
          mine.delete(sid)
        }
      }
      return Promise.resolve([...mine.keys()])
    },
    removeSessions: (userId, sids) => {
      for (const sid of sids) {
        sessions.get(userId)?.delete(sid)
      }
      return Promise.resolve()
    },
  }
}

let shared: AccountStore | undefined

/** The tenant's store: Redis when configured, else this process's memory. */
export function staffAccountStore(): AccountStore {
  if (shared) {
    return shared
  }
  const env = parseEnv()
  const prefix = `qt:staff:${tenantNamespace(env.DATABASE_URL, env.NODE_ENV, process.env["QT_TEST_RUN"])}:`
  shared = env.REDIS_URL
    ? createRedisAccountStore(createRedisClient(env.REDIS_URL, "staff_account"), prefix)
    : createMemoryAccountStore()
  return shared
}
