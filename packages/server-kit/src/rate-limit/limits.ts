import type { RateLimitStore } from "./store"

/**
 * A rate limit profile (docs/04): up to three limits, per client IP (an IPv6
 * client by its /64), per IP and identity (an e-mail, a cart), and per
 * identity from every address. One address cannot spray many accounts, nor
 * guess one account quickly. Each app keeps its own table of profiles.
 */

export interface Limit {
  max: number
  windowMs: number
}

export interface RateLimitProfile {
  name: string
  perIp?: Limit
  perIdentity?: Limit
  /**
   * Per identity from every address together. Only for identities a client
   * holds rather than names (a cart's id): counted so, an e-mail would let
   * anyone lock its owner out; a cart's tries are not spread over addresses.
   */
  perIdentityAnyIp?: Limit
}

export interface RateLimitCheck {
  store: RateLimitStore
  profile: RateLimitProfile
  /** The client's bucket (`ipBucket`), or "unknown". */
  ip: string
  /**
   * The identity as the app keys it: never an e-mail or phone number as it
   * is, nor a plain hash of one (a keyed hash, `hashPii`). Undefined or empty
   * skips the identity limits.
   */
  identityKey?: string | undefined
  /** Multiplies the per-IP limit (relaxed test and load runs). */
  scale?: number
}

/** Seconds until the request may be tried again, or null when it is within every limit. */
export async function retryAfterSeconds({
  store,
  profile,
  ip,
  identityKey,
  scale = 1,
}: RateLimitCheck): Promise<number | null> {
  const checks: [string, Limit][] = []
  if (profile.perIp) {
    checks.push([`${profile.name}:ip:${ip}`, { ...profile.perIp, max: profile.perIp.max * scale }])
  }
  if (identityKey !== undefined && identityKey !== "") {
    if (profile.perIdentity) {
      checks.push([`${profile.name}:id:${ip}:${identityKey}`, profile.perIdentity])
    }
    if (profile.perIdentityAnyIp) {
      checks.push([`${profile.name}:any:${identityKey}`, profile.perIdentityAnyIp])
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
