import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, ipBucket, perIpScale } from "@qticaret/server-kit"
import type { RateLimitProfile, RateLimitStore } from "@qticaret/server-kit"
import { CP_RATE_LIMIT_PROFILES } from "../../lib/rate-limit-profiles"
import { sharedRateLimitStore } from "./rate-limit"
import { loggerOf, rejectRequest } from "./request"
import { tenantCallerOf } from "./tenant-api"

export interface AddressLimitOptions {
  profile?: RateLimitProfile
  store?: (req: MedusaRequest) => RateLimitStore
  /** Whether the shop's signature passed (the tenant API guard's verdict). */
  verified?: (req: MedusaRequest) => boolean
}

/**
 * The tenant API's per-address budget before the signature (PR #371 D4):
 * it counts only what no shop's signature vouched for (unsigned, refused,
 * or answered before the guard). A signed request counts in its own shop's
 * bucket after the guard (`tenant_api_signer`, `tenant_api_ai`), so shops
 * behind one address no longer share these 300 a minute.
 *
 * The bucket is looked at (not counted) on the way in, and counted once
 * the answer is out and the guard's verdict known: the store cannot take
 * a hit back. Requests in flight at once can pass the line together, by
 * as many as are in flight; the per-shop buckets and the signature's cost
 * bound the rest. A store that fails lets the request through, logged.
 */
export function tenantApiAddressLimit(options: AddressLimitOptions = {}) {
  const scale = perIpScale()
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const profile = options.profile ?? CP_RATE_LIMIT_PROFILES.tenant_api
    const limit = profile.perIp
    if (!limit) {
      next()
      return
    }
    const verified = options.verified ?? ((each: MedusaRequest) => tenantCallerOf(each) !== null)
    const key = `${profile.name}:ip:${ipBucket(req.ip ?? req.socket.remoteAddress) ?? "unknown"}`
    const failed = (error: unknown) => {
      loggerOf(req)?.error(
        `rate_limit.store_failed ${JSON.stringify({ err: errorSummary(error) })}`
      )
    }
    let store: RateLimitStore
    let spent: number
    try {
      store = options.store?.(req) ?? sharedRateLimitStore(req)
      spent = await store.peek(key)
    } catch (error) {
      failed(error)
      next()
      return
    }
    if (spent >= limit.max * scale) {
      res.setHeader("Retry-After", String(Math.ceil(limit.windowMs / 1000)))
      rejectRequest(
        req,
        res,
        429,
        { type: "too_many_requests", message: "errors.too_many_requests" },
        `rate_limit_${profile.name}`
      )
      return
    }
    res.once("close", () => {
      if (!verified(req)) {
        store.hit(key, limit.windowMs).catch(failed)
      }
    })
    next()
  }
}
