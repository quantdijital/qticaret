import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, ipBucket, perIpScale } from "@qticaret/server-kit"
import type { RateLimitProfile, RateLimitStore } from "@qticaret/server-kit"
import { CP_RATE_LIMIT_PROFILES } from "../../lib/rate-limit-profiles"
import { addressInFlightCap, holdAddressSlot } from "./address-in-flight"
import { sharedRateLimitStore } from "./rate-limit"
import { loggerOf, rejectRequest } from "./request"
import { tenantCallerOf } from "./tenant-api"

export interface AddressLimitOptions {
  profile?: RateLimitProfile
  store?: (req: MedusaRequest) => RateLimitStore
  /** Whether the shop's signature passed (the tenant API guard's verdict). */
  verified?: (req: MedusaRequest) => boolean
}

/** Each request's address slot, given back early once the guard passes it. */
const slots = new WeakMap<MedusaRequest, () => void>()

const tooMany = (req: MedusaRequest, res: MedusaResponse, windowMs: number, reason: string) => {
  res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)))
  rejectRequest(
    req,
    res,
    429,
    { type: "too_many_requests", message: "errors.too_many_requests" },
    reason
  )
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
 * a hit back. So that requests sent at once cannot all pass the line
 * together (PR #374 review Y1), an address holds at most
 * `CP_TENANT_API_MAX_IN_FLIGHT_PER_ADDRESS` requests not yet vouched for
 * (address-in-flight.ts): taken synchronously on the way in, before the
 * store, the guard or the database; the one past it is refused 429. A
 * store that fails lets the request through, logged.
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
    const bucket = ipBucket(req.ip ?? req.socket.remoteAddress) ?? "unknown"
    const release = holdAddressSlot(`${profile.name}:${bucket}`, addressInFlightCap(scale))
    if (!release) {
      tooMany(req, res, limit.windowMs, `rate_limit_${profile.name}_in_flight`)
      return
    }
    slots.set(req, release)
    res.once("finish", release)
    res.once("close", release)
    const key = `${profile.name}:ip:${bucket}`
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
      tooMany(req, res, limit.windowMs, `rate_limit_${profile.name}`)
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

/**
 * After the tenant API guard: the request is a verified shop's now, so its
 * address slot goes back at once (its own shop's buckets and in-flight
 * count hold it from here). Reached only when the guard passed it.
 */
export function releaseVerifiedAddressSlot(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): void {
  if (tenantCallerOf(req) !== null) {
    slots.get(req)?.()
  }
  next()
}
