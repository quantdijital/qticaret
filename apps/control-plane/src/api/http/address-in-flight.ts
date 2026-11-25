import { CP_TENANT_API_MAX_IN_FLIGHT_PER_ADDRESS } from "../../lib/rate-limit-profiles"

/**
 * The tenant API's requests in flight per client address before a
 * signature vouches for them (PR #374 review Y1). The address budget is
 * counted once an answer is out, so requests sent at once would all see
 * it unspent; this count is taken on the way in, synchronously, so at
 * most `CP_TENANT_API_MAX_IN_FLIGHT_PER_ADDRESS` of one address's
 * requests reach the store, the guard and the database together. A slot
 * is given back once the guard passes the request (a verified shop's
 * long call never holds its address) or once its answer is over,
 * whichever comes first, and only once. Counted in this process only, as
 * the gateway's own in-flight counts are (lib/ai-gateway/in-flight.ts).
 */

let tuned: number | null = null
let total = 0
const byAddress = new Map<string, number>()

/**
 * The cap in force: rate-limit-profiles.ts's times the rate limits' scale
 * (`perIpScale`: a load test's or a relaxed test run's), or a test's own
 * exact cap.
 */
export const addressInFlightCap = (scale = 1): number =>
  tuned ?? CP_TENANT_API_MAX_IN_FLIGHT_PER_ADDRESS * scale

/** Tests only: an exact cap, unscaled; null puts rate-limit-profiles.ts's back. */
export function tuneAddressInFlight(own: number | null): void {
  tuned = own
}

/**
 * A slot for one request from `address` (its rate limit bucket), or null:
 * the address has `limit` in flight already. The function given back is
 * safe to call more than once.
 */
export function holdAddressSlot(
  address: string,
  limit: number = addressInFlightCap()
): (() => void) | null {
  const own = byAddress.get(address) ?? 0
  if (own >= limit) {
    return null
  }
  byAddress.set(address, own + 1)
  total += 1
  let given = false
  return () => {
    if (given) {
      return
    }
    given = true
    total = Math.max(0, total - 1)
    const left = (byAddress.get(address) ?? 0) - 1
    if (left > 0) {
      byAddress.set(address, left)
    } else {
      byAddress.delete(address)
    }
  }
}

/** The requests in flight now: in all, or from one address bucket. */
export const addressRequestsInFlight = (address?: string): number =>
  address === undefined ? total : (byAddress.get(address) ?? 0)

/** Tests only: forget every slot. */
export function resetAddressInFlight(): void {
  total = 0
  byAddress.clear()
}
