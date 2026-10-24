import Redis from "ioredis"
import { logger } from "../../logging"

/**
 * Fixed-window counters for rate limiting (docs/04). Redis when REDIS_URL
 * is set, so every instance shares one count; process memory otherwise
 * (dev and test, where there is a single process), and as the fallback
 * while Redis is down.
 */

export interface WindowCount {
  /** Hits in the current window, this one included. */
  count: number
  /** Milliseconds until the window resets. */
  resetMs: number
}

export interface RateLimitStore {
  hit: (key: string, windowMs: number) => Promise<WindowCount>
  /** Resolves once the store can count; until then hits fail and the limiter steps aside. */
  ready?: () => Promise<void>
  close?: () => Promise<void>
}

const MAX_MEMORY_KEYS = 50_000
const SWEEP_EVERY_MS = 60_000

export function createMemoryStore(
  now: () => number = Date.now,
  maxKeys = MAX_MEMORY_KEYS
): RateLimitStore {
  // Map order is insertion order; re-inserting on every hit keeps the least
  // recently used key first
  const windows = new Map<string, { count: number; endsAt: number }>()
  let lastSweep = now()
  return {
    hit: (key, windowMs) => {
      const time = now()
      if (time - lastSweep >= SWEEP_EVERY_MS) {
        for (const [stored, window] of windows) {
          if (window.endsAt <= time) {
            windows.delete(stored)
          }
        }
        lastSweep = time
      }
      const current = windows.get(key)
      const window =
        current && current.endsAt > time ? current : { count: 0, endsAt: time + windowMs }
      window.count += 1
      windows.delete(key)
      windows.set(key, window)
      // A flood of distinct keys cannot grow memory without bound: past the
      // cap the least recently used key goes, one per hit
      if (windows.size > maxKeys) {
        const oldest = windows.keys().next()
        if (oldest.done !== true) {
          windows.delete(oldest.value)
        }
      }
      return Promise.resolve({ count: window.count, resetMs: window.endsAt - time })
    },
  }
}

export interface FallbackOptions {
  /** How long the primary store is skipped after it fails. */
  cooldownMs?: number
  now?: () => number
  /** Called once per failure, so at most once per cooldown. */
  onError?: (error: unknown) => void
}

/**
 * Counts in `fallback` while `primary` is down: a Redis outage keeps the
 * limits per instance instead of lifting them, and requests do not wait on
 * a dead Redis for the length of the cooldown.
 */
export function withFallback(
  primary: RateLimitStore,
  fallback: RateLimitStore,
  { cooldownMs = 30_000, now = Date.now, onError }: FallbackOptions = {}
): RateLimitStore {
  let skipUntil = 0
  return {
    hit: async (key, windowMs) => {
      if (now() >= skipUntil) {
        try {
          return await primary.hit(key, windowMs)
        } catch (error) {
          skipUntil = now() + cooldownMs
          onError?.(error)
        }
      }
      return fallback.hit(key, windowMs)
    },
    ...(primary.ready ? { ready: primary.ready } : {}),
    ...(primary.close ? { close: primary.close } : {}),
  }
}

/** Name and message only: ioredis errors carry the command, whose key holds a client IP. */
export const errorSummary = (error: unknown) =>
  error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) }

// INCR and the expiry in one step: a crash between them would leave a key
// that never expires and blocks its owner for good
const HIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`

type CountingRedis = Redis & {
  rateLimitHit: (key: string, windowMs: string) => Promise<[number, number]>
}

const ERROR_LOG_EVERY_MS = 60_000

/** A Redis client of our own: Medusa does not expose its connection. */
export function createRedisStore(redisUrl: string, prefix = "qt:rl:"): RateLimitStore {
  const client = new Redis(redisUrl, {
    // A limiter must answer fast or step aside: commands wait for the
    // connection (so the first requests after start are counted) but give up
    // within a retry and the command timeout when Redis is down
    maxRetriesPerRequest: 1,
    enableOfflineQueue: true,
    connectTimeout: 2_000,
    commandTimeout: 500,
    lazyConnect: false,
  }) as CountingRedis
  // Sent by SHA after the first call (EVALSHA), not as a whole script each time
  client.defineCommand("rateLimitHit", { numberOfKeys: 1, lua: HIT_SCRIPT })
  // Without a listener ioredis prints unhandled errors to the console. It
  // reconnects every few seconds during an outage, so this logs once a minute
  let lastErrorLog = Number.NEGATIVE_INFINITY
  client.on("error", (error: unknown) => {
    if (Date.now() - lastErrorLog >= ERROR_LOG_EVERY_MS) {
      lastErrorLog = Date.now()
      logger.warn({ event: "rate_limit.redis_error", err: errorSummary(error) })
    }
  })
  return {
    hit: async (key, windowMs) => {
      const [count, ttl] = await client.rateLimitHit(`${prefix}${key}`, String(windowMs))
      return { count, resetMs: ttl }
    },
    ready: () =>
      client.status === "ready"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            client.once("ready", () => {
              resolve()
            })
          }),
    close: async () => {
      await client.quit()
    },
  }
}
