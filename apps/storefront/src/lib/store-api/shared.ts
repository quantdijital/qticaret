import "server-only"
import { isPersonalPath, personalPriceIn } from "./personal"
import { storeCaches } from "./registry"

/**
 * Shop-wide answers kept a short while in the storefront's own process
 * (adr/0046 §2 amended, D12): the frame every page needs (site SEO, the
 * category tree, the storefront settings, the legal identity, the URL
 * registry's paths) is the same for every shopper. Without this each page
 * asked the backend for it again, and a shopper browsing fast (or many
 * behind one address) met the backend's per-address limit. Nothing
 * personal is kept here: these calls go without the customer's key.
 * A failure is not kept.
 */
const SHARED_TTL_MS = 60_000
const MAX_ENTRIES = 1000

// In the process-wide registry: the refresh route clears what every bundle reads
const entries = storeCaches().shared

function prune(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.until <= now) {
      entries.delete(key)
    }
  }
  // Still too many: the oldest go (a Map keeps insertion order)
  for (const key of entries.keys()) {
    if (entries.size <= MAX_ENTRIES) {
      break
    }
    entries.delete(key)
  }
}

/**
 * Kept for every shopper, so never a person's (ADR-0068 §7, review I3): a
 * customer's own route is refused before it is asked, and an answer
 * holding a wholesaler's price fails for every caller waiting on it (a
 * bug to fix, not a page to show to the next shopper). One too large to
 * look through is answered but not kept.
 */
export function shared<T>(key: string, load: () => Promise<T>, ttlMs = SHARED_TTL_MS): Promise<T> {
  if (isPersonalPath(pathOf(key))) {
    return Promise.reject(new Error(`shared cache: ${pathOf(key)} is a customer's own route`))
  }
  const now = Date.now()
  const hit = entries.get(key)
  if (hit && hit.until > now) {
    return hit.value as Promise<T>
  }
  const value = load().then((answer) => {
    const personal = personalPriceIn(answer)
    if (personal === "yes") {
      throw new Error(`shared cache: ${pathOf(key)} answered a wholesaler's price`)
    }
    if (personal === "unknown") {
      queueMicrotask(() => {
        if (entries.get(key)?.value === value) {
          entries.delete(key)
        }
      })
    }
    return answer
  })
  entries.set(key, { until: now + ttlMs, value })
  value.catch(() => {
    if (entries.get(key)?.value === value) {
      entries.delete(key)
    }
  })
  if (entries.size > MAX_ENTRIES) {
    prune(now)
  }
  return value
}

/** The path of a key (`<path>?<query JSON>`). */
const pathOf = (key: string): string => {
  const at = key.indexOf("?")
  return at === -1 ? key : key.slice(0, at)
}

/**
 * Drops the answers of these paths (adr/0048 Ek 2026-11-03): a path
 * ending in `/` drops everything under it (`/store/legal/` every legal
 * text), any other only itself, whatever its query. Returns how many went.
 */
export function forgetShared(paths: readonly string[]): number {
  let dropped = 0
  for (const key of [...entries.keys()]) {
    const path = pathOf(key)
    if (paths.some((each) => (each.endsWith("/") ? path.startsWith(each) : path === each))) {
      entries.delete(key)
      dropped++
    }
  }
  return dropped
}
