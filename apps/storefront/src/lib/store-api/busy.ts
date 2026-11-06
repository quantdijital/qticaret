import { storeCaches } from "./registry"

/**
 * The backend's rate limit as a page's 503 (docs/21 2026-11-06, 10). A
 * visitor past its limit (a fast crawler) gets the backend's 429 on the
 * reads a page makes; a page cannot answer with a status of its own, so
 * Next sends a 500. Kept here per visitor until the backend's
 * `Retry-After`, the proxy answers that visitor's page views with a 503
 * and the same `Retry-After`: "come back later", the one a crawler slows
 * down for and keeps the pages through. Not `server-only`: the proxy
 * reads what the pages' requests noted, through the process's registry.
 *
 * Only reads say this. A form's own limit (a login, a message) answers its
 * form; the live search (`/store/listings/suggest`) and the maintenance
 * bypass check have small limits of their own that say nothing about the
 * visitor's pages.
 */

const DEFAULT_WAIT_S = 30
const MAX_WAIT_S = 300
const MAX_ENTRIES = 10_000

const OWN_LIMIT_READS = ["/store/listings/suggest", "/store/maintenance/bypass/"]

const entries = () => storeCaches().busy
// The visitor's signed address; without one (no proxy hop trusted) the backend counts the storefront's own
const keyOf = (visitorIp: string | null) => visitorIp ?? "-"

/** Seconds to wait from a `Retry-After` (seconds or an HTTP date), within 1 and 300. */
export function waitSecondsOf(retryAfter: string | null, now = Date.now()): number {
  const value = retryAfter?.trim() ?? ""
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : value !== "" && !Number.isNaN(Date.parse(value))
      ? Math.ceil((Date.parse(value) - now) / 1000)
      : DEFAULT_WAIT_S
  return Math.min(MAX_WAIT_S, Math.max(1, seconds))
}

/** Whether a 429 on this call says the visitor's pages will fail too. */
export const isPageRead = (method: string, path: string): boolean =>
  method === "GET" && !OWN_LIMIT_READS.some((own) => path.startsWith(own))

/** The backend refused this visitor's read with a 429: its pages wait until `Retry-After`. */
export function noteRateLimited(
  visitorIp: string | null,
  retryAfter: string | null,
  now = Date.now()
): void {
  const map = entries()
  map.set(keyOf(visitorIp), { until: now + waitSecondsOf(retryAfter, now) * 1000, value: null })
  if (map.size <= MAX_ENTRIES) {
    return
  }
  for (const [key, entry] of map) {
    if (entry.until <= now) {
      map.delete(key)
    }
  }
  // Still too many: the oldest go (a Map keeps insertion order)
  for (const key of map.keys()) {
    if (map.size <= MAX_ENTRIES) {
      break
    }
    map.delete(key)
  }
}

/** Seconds this visitor's pages still wait, or null when the backend takes them. */
export function rateLimitedFor(visitorIp: string | null, now = Date.now()): number | null {
  const key = keyOf(visitorIp)
  const hit = entries().get(key)
  if (!hit) {
    return null
  }
  if (hit.until <= now) {
    entries().delete(key)
    return null
  }
  return Math.max(1, Math.ceil((hit.until - now) / 1000))
}
