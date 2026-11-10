import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  authIdentityField,
  authRouteKind,
  hashPii,
  parseKey,
  retryAfterSeconds,
} from "@qticaret/server-kit"
import type { AuthRouteKind } from "@qticaret/server-kit"
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
import type { RateLimitProfile, RateLimitStore } from "../../lib/security/rate-limit"
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
      const identity = options.identity?.(req)
      const countsIdentity = profile.perIdentity ?? profile.perIdentityAnyIp
      wait = await retryAfterSeconds({
        store,
        profile,
        ip: clientBucket(req),
        identityKey:
          countsIdentity && identity !== undefined && identity.trim() !== ""
            ? identityKey(identity)
            : undefined,
        scale,
      })
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

// Each kind of /auth/* route (@qticaret/server-kit) counts in its profile
const AUTH_PROFILES: Record<AuthRouteKind, RateLimitProfile> = {
  token_refresh: RATE_LIMIT_PROFILES.token_refresh,
  session: RATE_LIMIT_PROFILES.auth_default,
  register: RATE_LIMIT_PROFILES.register,
  password_reset: RATE_LIMIT_PROFILES.password_reset,
  auth_default: RATE_LIMIT_PROFILES.auth_default,
  login: RATE_LIMIT_PROFILES.login,
}

/**
 * The /auth/* profile from the path: login, registration, reset, refresh.
 * Any other path gets the login profile, the strictest: a path these
 * patterns miss must not miss the login limit with them.
 */
export function authProfile(req: MedusaRequest): RateLimitProfile {
  return AUTH_PROFILES[authRouteKind(routePath(req))]
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
  const value = body?.[authIdentityField(routePath(req))]
  return typeof value === "string" ? value : undefined
}
