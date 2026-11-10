import { createRedisClient, tenantNamespace } from "@qticaret/server-kit"
import { parseEnv } from "../env"

type Redis = ReturnType<typeof createRedisClient>

/**
 * The ids of each staff member's sessions, noted at sign-in, so listing
 * and ending them never reads the whole session store (the shop's
 * account-store sessions half, copied: the shop keeps its address change
 * beside it). Each id with its expiry; Redis under the control plane's
 * namespace, process memory without Redis.
 */
export interface SessionIndex {
  add: (userId: string, sid: string, ttlMs: number) => Promise<void>
  /** The noted ids not yet past their lifetime, each with its expiry (ms). */
  list: (userId: string) => Promise<{ sid: string; expiresAt: number }[]>
  remove: (userId: string, sids: readonly string[]) => Promise<void>
}

export function createRedisSessionIndex(redis: Redis, prefix: string): SessionIndex {
  const keyOf = (userId: string) => `${prefix}sessions:${userId}`
  return {
    add: async (userId, sid, ttlMs) => {
      const key = keyOf(userId)
      await redis
        .multi()
        .zadd(key, Date.now() + ttlMs, sid)
        .pexpire(key, ttlMs)
        .exec()
    },
    list: async (userId) => {
      const key = keyOf(userId)
      await redis.zremrangebyscore(key, "-inf", Date.now())
      const flat = await redis.zrange(key, 0, -1, "WITHSCORES")
      const out: { sid: string; expiresAt: number }[] = []
      for (let i = 0; i + 1 < flat.length; i += 2) {
        out.push({ sid: flat[i] ?? "", expiresAt: Number(flat[i + 1]) })
      }
      return out
    },
    remove: async (userId, sids) => {
      if (sids.length > 0) {
        await redis.zrem(keyOf(userId), ...sids)
      }
    },
  }
}

export function createMemorySessionIndex(now: () => number = Date.now): SessionIndex {
  const sessions = new Map<string, Map<string, number>>()
  return {
    add: (userId, sid, ttlMs) => {
      const mine = sessions.get(userId) ?? new Map<string, number>()
      mine.set(sid, now() + ttlMs)
      sessions.set(userId, mine)
      return Promise.resolve()
    },
    list: (userId) => {
      const mine = sessions.get(userId) ?? new Map<string, number>()
      for (const [sid, until] of mine) {
        if (until <= now()) {
          mine.delete(sid)
        }
      }
      return Promise.resolve([...mine].map(([sid, expiresAt]) => ({ sid, expiresAt })))
    },
    remove: (userId, sids) => {
      for (const sid of sids) {
        sessions.get(userId)?.delete(sid)
      }
      return Promise.resolve()
    },
  }
}

let shared: SessionIndex | undefined

/** The control plane's index: Redis when configured, else this process's memory. */
export function sessionIndex(
  onRedisError: (error: unknown) => void = () => undefined
): SessionIndex {
  if (shared) {
    return shared
  }
  const env = parseEnv()
  const namespace = tenantNamespace(env.DATABASE_URL, env.NODE_ENV, process.env["QT_TEST_RUN"])
  shared = env.REDIS_URL
    ? createRedisSessionIndex(
        createRedisClient(env.REDIS_URL, onRedisError),
        `qt:cp-staff:${namespace}:`
      )
    : createMemorySessionIndex()
  return shared
}
