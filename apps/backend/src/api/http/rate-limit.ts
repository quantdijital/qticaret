import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hashPii, parseKey } from "@qticaret/server-kit"
import { isLocalEnv, parseEnv } from "../../lib/env"
import { errorSummary, logger } from "../../lib/logging"
import { tenantNamespace } from "../../lib/redis"
import {
  RATE_LIMIT_PROFILES,
  createMemoryStore,
  createRedisStore,
  ipBucket,
  perIpScale,
  withFallback,
} from "../../lib/security/rate-limit"
import type { Limit, RateLimitProfile, RateLimitStore } from "../../lib/security/rate-limit"
import { rejectRequest } from "./reject"
import { routePath } from "./request-path"
import { clientIp } from "./client-ip"

/**
 * Rate limiting for API routes (docs/04, F2.10). It runs after Medusa's
 * admin auth and publishable key checks, so a request without a key costs
 * nothing here. While Redis is down the counts move to process memory; a
 * store that fails outright fails open: the shop stays up and it is logged.
 */

let sharedStore: RateLimitStore | undefined

/**
 * Counters live under the tenant's namespace (see `tenantNamespace`). An
 * integration test file counts under a run of its own (`QT_TEST_RUN`), so
 * one run's sign-ups never fill the next one's limits.
 */
export function rateLimitPrefix(
  databaseUrl: string,
  nodeEnv?: string,
  testRun: string | undefined = process.env["QT_TEST_RUN"]
): string {
  return `qt:rl:${tenantNamespace(databaseUrl, nodeEnv, testRun)}:`
}

/** The tenant's shared counters (Redis, or process memory while it is down): for SMS quotas too. */
export function sharedRateLimitStore(): RateLimitStore {
  return defaultStore()
}

function defaultStore(): RateLimitStore {
  if (sharedStore) {
    return sharedStore
  }
  const env = parseEnv()
  if (process.env["RATE_LIMIT_RELAXED"] !== undefined && env.NODE_ENV !== "test") {
    logger.warn({ event: "rate_limit.relaxed_ignored", nodeEnv: env.NODE_ENV ?? null })
  }
  const memory = createMemoryStore()
  if (env.REDIS_URL === undefined) {
    if (!isLocalEnv(env)) {
      // Each instance counts on its own: N instances allow N times the limit
      logger.warn({ event: "rate_limit.memory_store", nodeEnv: env.NODE_ENV ?? null })
    }
    sharedStore = memory
  } else {
    sharedStore = withFallback(
      createRedisStore(env.REDIS_URL, rateLimitPrefix(env.DATABASE_URL, env.NODE_ENV)),
      memory,
      {
        onError: (error) => {
          logger.error({ event: "rate_limit.store_failed", err: errorSummary(error) })
        },
      }
    )
  }
  return sharedStore
}

let identityHashKey: Buffer | undefined

// The limiter never stores an e-mail or phone number as it is, nor a plain
// hash of one, which a dictionary would reverse
function identityKey(identity: string): string {
  identityHashKey ??= parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")
  return hashPii(identity.trim().toLowerCase(), identityHashKey, "rate_limit").slice(0, 32)
}

/** The visitor's address as limits count it (IPv6 by its /64). */
export const clientBucket = (req: MedusaRequest): string =>
  ipBucket(clientIp(req) ?? undefined) ?? "unknown"

/** Seconds until the request may be tried again, or null when it is within every limit. */
async function retryAfterSeconds(
  store: RateLimitStore,
  profile: RateLimitProfile,
  ip: string,
  identity: string | undefined,
  scale: number
): Promise<number | null> {
  const checks: [string, Limit][] = []
  if (profile.perIp) {
    checks.push([`${profile.name}:ip:${ip}`, { ...profile.perIp, max: profile.perIp.max * scale }])
  }
  if (identity !== undefined && identity.trim() !== "") {
    if (profile.perIdentity) {
      checks.push([`${profile.name}:id:${ip}:${identityKey(identity)}`, profile.perIdentity])
    }
    if (profile.perIdentityAnyIp) {
      checks.push([`${profile.name}:any:${identityKey(identity)}`, profile.perIdentityAnyIp])
    }
  }
  const counts = await Promise.all(
    checks.map(async ([key, limit]) => ({ limit, window: await store.hit(key, limit.windowMs) }))
  )
  const exceeded = counts.filter(({ limit, window }) => window.count > limit.max)
  if (exceeded.length === 0) {
    return null
  }
  return Math.max(1, Math.ceil(Math.max(...exceeded.map(({ window }) => window.resetMs)) / 1000))
}

export interface RateLimitOptions {
  store?: () => RateLimitStore
  /** The identity a profile counts per (an e-mail from the body). */
  identity?: (req: MedusaRequest) => string | undefined
  /** Multiplies per-IP limits; defaults to `perIpScale()` (relaxed in integration tests). */
  scale?: number
}

export function rateLimit(
  resolveProfile: (req: MedusaRequest) => RateLimitProfile | null,
  options: RateLimitOptions = {}
) {
  const scale = options.scale ?? perIpScale()
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const profile = resolveProfile(req)
    if (profile === null) {
      next()
      return
    }
    let wait: number | null
    try {
      const store = (options.store ?? defaultStore)()
      wait = await retryAfterSeconds(
        store,
        profile,
        clientBucket(req),
        options.identity?.(req),
        scale
      )
    } catch (error) {
      logger.error({
        event: "rate_limit.store_failed",
        profile: profile.name,
        err: errorSummary(error),
      })
      next()
      return
    }
    if (wait === null) {
      next()
      return
    }
    res.setHeader("Retry-After", String(wait))
    rejectRequest(
      req,
      res,
      429,
      { type: "too_many_requests", message: "errors.too_many_requests" },
      `rate_limit_${profile.name}`
    )
  }
}

const AUTH_ROUTES: readonly [RegExp, RateLimitProfile][] = [
  [/^\/auth\/token\/refresh$/, RATE_LIMIT_PROFILES.token_refresh],
  [/^\/auth\/session$/, RATE_LIMIT_PROFILES.auth_default],
  [/^\/auth\/[^/]+\/[^/]+\/register$/, RATE_LIMIT_PROFILES.register],
  [/^\/auth\/[^/]+\/[^/]+\/reset-password$/, RATE_LIMIT_PROFILES.password_reset],
  [/^\/auth\/[^/]+\/[^/]+\/(update|callback)$/, RATE_LIMIT_PROFILES.auth_default],
  [/^\/auth\/[^/]+\/[^/]+$/, RATE_LIMIT_PROFILES.login],
]

/**
 * The /auth/* profile from the path: login, registration, reset, refresh.
 * Any other path gets the login profile, the strictest: a path these
 * patterns miss must not miss the login limit with them.
 */
export function authProfile(req: MedusaRequest): RateLimitProfile {
  const path = routePath(req)
  return AUTH_ROUTES.find(([pattern]) => pattern.test(path))?.[1] ?? RATE_LIMIT_PROFILES.login
}

/**
 * The account a request targets, from the field its route reads: emailpass
 * login and registration read `email`, a reset reads `identifier`, a
 * verification request `entity_id`. Counting
 * another field would let a decoy value keep the real target's count at zero.
 */
export function authIdentity(req: MedusaRequest): string | undefined {
  const body = req.body as Record<string, unknown> | undefined
  // A verification request names its address `entity_id` (adr/0037 §1)
  const field =
    authProfile(req) === RATE_LIMIT_PROFILES.password_reset
      ? "identifier"
      : routePath(req) === "/auth/verification/request"
        ? "entity_id"
        : "email"
  const value = body?.[field]
  return typeof value === "string" ? value : undefined
}
