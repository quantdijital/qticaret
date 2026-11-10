import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Logger } from "@medusajs/framework/types"
import {
  authIdentityField,
  authRouteKind,
  createMemoryStore,
  createRedisClient,
  createRedisStoreWith,
  errorSummary,
  hashPii,
  ipBucket,
  parseKey,
  perIpScale,
  retryAfterSeconds,
  tenantNamespace,
  withFallback,
} from "@qticaret/server-kit"
import type { RateLimitProfile, RateLimitStore } from "@qticaret/server-kit"
import { isLocalEnv, parseEnv } from "../../lib/env"
import { CP_AUTH_PROFILES } from "../../lib/rate-limit-profiles"
import { loggerOf, rejectRequest, routePath } from "./request"

/**
 * Rate limits (docs/04) with the shop backend's counters and rules
 * (@qticaret/server-kit): Redis when set, process memory while it is down;
 * a store that fails outright fails open, logged. Counters live under the
 * control plane's own namespace (its database), apart from every shop's.
 */

let sharedStore: RateLimitStore | undefined

const logFailure = (logger: Logger | undefined, event: string, error: unknown) => {
  logger?.error(`${event} ${JSON.stringify({ err: errorSummary(error) })}`)
}

function defaultStore(logger: Logger | undefined): RateLimitStore {
  if (sharedStore) {
    return sharedStore
  }
  const env = parseEnv()
  const memory = createMemoryStore()
  if (env.REDIS_URL === undefined) {
    if (!isLocalEnv(env)) {
      logger?.warn("rate_limit.memory_store")
    }
    sharedStore = memory
    return sharedStore
  }
  const namespace = tenantNamespace(env.DATABASE_URL, env.NODE_ENV, process.env["QT_TEST_RUN"])
  const client = createRedisClient(env.REDIS_URL, (error) => {
    logFailure(logger, "rate_limit.redis_error", error)
  })
  sharedStore = withFallback(createRedisStoreWith(client, `qt:rl:${namespace}:`), memory, {
    onError: (error) => {
      logFailure(logger, "rate_limit.store_failed", error)
    },
  })
  return sharedStore
}

/** The shared counters (rate limits, wrong proofs, codes used once). */
export const sharedRateLimitStore = (req: MedusaRequest): RateLimitStore =>
  defaultStore(loggerOf(req))

let identityHashKey: Buffer | undefined

// Never an e-mail as it is, nor a plain hash a dictionary would reverse
function identityKey(identity: string): string {
  identityHashKey ??= parseKey(parseEnv().CP_HASH_KEY, "CP_HASH_KEY")
  return hashPii(identity.trim().toLowerCase(), identityHashKey, "rate_limit").slice(0, 32)
}

/** The client's address as limits count it (IPv6 by its /64), behind the trusted proxy. */
const clientBucket = (req: MedusaRequest): string =>
  ipBucket(req.ip ?? req.socket.remoteAddress) ?? "unknown"

export interface RateLimitOptions {
  store?: () => RateLimitStore
  /** The identity a profile counts per (an e-mail from the body). */
  identity?: (req: MedusaRequest) => string | undefined
}

export function rateLimit(
  resolveProfile: (req: MedusaRequest) => RateLimitProfile,
  options: RateLimitOptions = {}
) {
  const scale = perIpScale()
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const profile = resolveProfile(req)
    let wait: number | null
    try {
      const store = options.store?.() ?? defaultStore(loggerOf(req))
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
      logFailure(loggerOf(req), "rate_limit.store_failed", error)
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

/** The /auth/* profile from the path; a path no pattern names counts as a login. */
export const authProfile = (req: MedusaRequest): RateLimitProfile =>
  CP_AUTH_PROFILES[authRouteKind(routePath(req))]

/** The account an /auth/* request targets, from the body field its route reads. */
export function authIdentity(req: MedusaRequest): string | undefined {
  const body = req.body as Record<string, unknown> | undefined
  const value = body?.[authIdentityField(routePath(req))]
  return typeof value === "string" ? value : undefined
}
