import { RetryableError } from "../../errors"
import type { RateLimitStore } from "../../security/rate-limit"

/**
 * Paraşüt takes at most 10 requests in 10 seconds (API v4). Every process
 * of the shop counts in one window (Redis when there is one) and waits
 * for the next window past 9, one short of the limit for a clock that
 * runs a little apart from Paraşüt's.
 */

const WINDOW_MS = 10_000
const LIMIT = 9
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
