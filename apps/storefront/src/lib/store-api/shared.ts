import "server-only"

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

const entries = new Map<string, { until: number; value: Promise<unknown> }>()

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

export function shared<T>(key: string, load: () => Promise<T>, ttlMs = SHARED_TTL_MS): Promise<T> {
  const now = Date.now()
  const hit = entries.get(key)
  if (hit && hit.until > now) {
    return hit.value as Promise<T>
  }
  const value = load()
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
