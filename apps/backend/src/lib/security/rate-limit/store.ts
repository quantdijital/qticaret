import { createRedisStoreWith } from "@qticaret/server-kit"
import type { RateLimitStore } from "@qticaret/server-kit"
import { createRedisClient } from "../../redis"

// The counters themselves are shared with the control plane (adr/0061, C3)
export { createMemoryStore, withFallback } from "@qticaret/server-kit"
export type { FallbackOptions, RateLimitStore, WindowCount } from "@qticaret/server-kit"

/** Counters in Redis, shared by every instance; fails fast so the fallback takes over. */
export function createRedisStore(redisUrl: string, prefix = "qt:rl:"): RateLimitStore {
  return createRedisStoreWith(createRedisClient(redisUrl, "rate_limit"), prefix)
}
