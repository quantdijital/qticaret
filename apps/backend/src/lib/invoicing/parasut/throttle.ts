import { RetryableError } from "../../errors"
import type { RateLimitStore } from "../../security/rate-limit"

/**
 * Paraşüt takes at most 10 requests in 10 seconds (API v4); how it counts
 * them is not documented. Every process of the shop counts in one fixed
 * window (Redis when there is one) and waits for the next past 5: two
 * windows back to back then hold 10 at most, however Paraşüt slides its
 * own. About three invoices a minute, enough for a small shop's day.
 */

const WINDOW_MS = 10_000
const LIMIT = 5
// Windows waited before giving the turn up: the caller tries again later
const MAX_WAITS = 4

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export function parasutThrottle(
  store: RateLimitStore,
  companyId: string,
  sleep: (ms: number) => Promise<void> = wait
): () => Promise<void> {
  return async () => {
    for (let waited = 0; waited <= MAX_WAITS; waited++) {
      const { count, resetMs } = await store.hit(`parasut:${companyId}`, WINDOW_MS)
      if (count <= LIMIT) {
        return
      }
      await sleep(resetMs + 50)
    }
    throw new RetryableError("einvoice.rate_limited")
  }
}
