import { createRedisClient, tenantNamespace } from "@qticaret/server-kit"
import { parseEnv } from "../env"

type Redis = ReturnType<typeof createRedisClient>

/**
 * The ids of each staff member's sessions, noted at sign-in (the shop's
 * account-store sessions half, copied). Authoritative here (Ek C4, M1): a
 * session the index does not hold reaches nothing, so ending a session is
 * dropping its id, even from a process that cannot reach the session
 * store (`cp:end-sessions`). Beside it, which login a sign-in's 2FA
 * challenge belongs to, so the second step is counted against that login
 * whatever the request says (M4). Redis under the control plane's
 * namespace; process memory without Redis (development only).
 */
export interface SessionIndex {
  add: (userId: string, sid: string, ttlMs: number) => Promise<void>
  has: (userId: string, sid: string) => Promise<boolean>
  /** The noted ids not yet past their lifetime, each with its expiry (ms). */
  list: (userId: string) => Promise<{ sid: string; expiresAt: number }[]>
  remove: (userId: string, sids: readonly string[]) => Promise<void>
  clear: (userId: string) => Promise<void>
  noteChallenge: (challengeId: string, identity: string, ttlMs: number) => Promise<void>
  challengeIdentity: (challengeId: string) => Promise<string | null>
}

export function createRedisSessionIndex(redis: Redis, prefix: string): SessionIndex {
  const keyOf = (userId: string) => `${prefix}sessions:${userId}`
  const challengeOf = (id: string) => `${prefix}challenge:${id}`
  return {
    add: async (userId, sid, ttlMs) => {
      const key = keyOf(userId)
      await redis
        .multi()
        .zadd(key, Date.now() + ttlMs, sid)
        .pexpire(key, ttlMs)
        .exec()
    },
    has: async (userId, sid) => {
      const until = await redis.zscore(keyOf(userId), sid)
      return until !== null && Number(until) > Date.now()
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
    clear: async (userId) => {
      await redis.del(keyOf(userId))
    },
    noteChallenge: async (challengeId, identity, ttlMs) => {
      await redis.set(challengeOf(challengeId), identity, "PX", ttlMs)
    },
    challengeIdentity: (challengeId) => redis.get(challengeOf(challengeId)),
  }
}

export function createMemorySessionIndex(now: () => number = Date.now): SessionIndex {
  const sessions = new Map<string, Map<string, number>>()
  const challenges = new Map<string, { identity: string; until: number }>()
  const live = (userId: string) => {
    const mine = sessions.get(userId) ?? new Map<string, number>()
    for (const [sid, until] of mine) {
      if (until <= now()) {
        mine.delete(sid)
      }
    }
    return mine
  }
  return {
    add: (userId, sid, ttlMs) => {
      const mine = live(userId)
      mine.set(sid, now() + ttlMs)
      sessions.set(userId, mine)
      return Promise.resolve()
    },
    has: (userId, sid) => Promise.resolve(live(userId).has(sid)),
    list: (userId) =>
      Promise.resolve([...live(userId)].map(([sid, expiresAt]) => ({ sid, expiresAt }))),
    remove: (userId, sids) => {
      for (const sid of sids) {
        sessions.get(userId)?.delete(sid)
      }
      return Promise.resolve()
    },
    clear: (userId) => {
      sessions.delete(userId)
      return Promise.resolve()
    },
    noteChallenge: (challengeId, identity, ttlMs) => {
      challenges.set(challengeId, { identity, until: now() + ttlMs })
      return Promise.resolve()
    },
    challengeIdentity: (challengeId) => {
      const entry = challenges.get(challengeId)
      return Promise.resolve(entry && entry.until > now() ? entry.identity : null)
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
