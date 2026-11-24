import type Redis from "ioredis"
import { parseEnv } from "../../lib/env"
import { createRedisClient, tenantNamespace } from "../../lib/redis"
import { registerProcessCache } from "../../lib/cache/process-caches"

// Failed tries the reconcile job gives one order before it leaves it alone
export const RECONCILE_MAX_ATTEMPTS = 3
// How long an order's failed tries are remembered (hours): after that it is tried again
export const RECONCILE_ATTEMPTS_TTL_HOURS = 24

const TTL_MS = RECONCILE_ATTEMPTS_TTL_HOURS * 60 * 60 * 1000

/**
 * How many times the reconcile job failed one order lately (adr/0076 Ek
 * takip L2): an order that always fails is tried a few times, then left
 * to staff for a day, never every run for its whole look-back. Order ids
 * only. Kept in Redis (`booking:reconcile:fail:<order id>`, a counter
 * with its time to live), in process memory without Redis (dev, tests).
 */
export interface ReconcileAttempts {
  count: (orderId: string) => Promise<number>
  /** One more failure; how many now. */
  fail: (orderId: string) => Promise<number>
  clear: (orderId: string) => Promise<void>
}

export function createMemoryReconcileAttempts(now: () => number = Date.now): ReconcileAttempts {
  const failures = new Map<string, { count: number; until: number }>()
  const live = (orderId: string) => {
    const entry = failures.get(orderId)
    return entry && entry.until > now() ? entry : undefined
  }
  return {
    count: (orderId) => Promise.resolve(live(orderId)?.count ?? 0),
    fail: (orderId) => {
      const entry = live(orderId) ?? { count: 0, until: now() + TTL_MS }
      entry.count += 1
      failures.set(orderId, entry)
      return Promise.resolve(entry.count)
    },
    clear: (orderId) => {
      failures.delete(orderId)
      return Promise.resolve()
    },
  }
}

export function createRedisReconcileAttempts(
  client: () => Redis,
  prefix: string
): ReconcileAttempts {
  const key = (orderId: string) => `${prefix}booking:reconcile:fail:${orderId}`
  return {
    count: async (orderId) => Number((await client().get(key(orderId))) ?? 0),
    fail: async (orderId) => {
      // The first failure starts the clock; later ones never push it back
      const count = await client().incr(key(orderId))
      if (count === 1) {
        await client().pexpire(key(orderId), TTL_MS)
      }
      return count
    },
    clear: async (orderId) => {
      await client().del(key(orderId))
    },
  }
}

let shared: ReconcileAttempts | undefined
// Without Redis (tests) the counters are the process's: a bundled test run
// gives each spec file fresh ones
registerProcessCache(() => {
  shared = undefined
})

/** The tenant's counters: Redis when it is set, except in tests, which keep their own. */
export function reconcileAttempts(): ReconcileAttempts {
  if (shared) {
    return shared
  }
  const env = parseEnv()
  if (env.REDIS_URL === undefined || env.NODE_ENV === "test") {
    shared = createMemoryReconcileAttempts()
    return shared
  }
  const url = env.REDIS_URL
  let client: Redis | undefined
  shared = createRedisReconcileAttempts(
    () => (client ??= createRedisClient(url, "booking_reconcile")),
    `qt:${tenantNamespace(env.DATABASE_URL, env.NODE_ENV)}:`
  )
  return shared
}
