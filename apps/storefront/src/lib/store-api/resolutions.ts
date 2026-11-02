import type { Resolution } from "@qticaret/types"
import { storeCaches } from "./registry"

/**
 * `GET /store/seo/resolve`'s answers kept ten seconds in this process
 * (adr/0046 §4, docs/21): the proxy resolves a page's path, then the page
 * asks again for its record and `seo` object; with this the second ask
 * is the first's answer. Not `server-only`: the proxy uses it too, and
 * the registry makes the proxy's and the pages' bundles share it.
 *
 * The answer depends on the path alone: the backend's route reads no
 * session, cookie or visitor (it says `public, max-age=60` itself), so a
 * path's answer is every visitor's. Only a page (`entity`) and a 404
 * (`not_found`) are kept: a redirect counts its rules' hits at the backend
 * on each ask, and the proxy answers a redirect or a 410 itself. The
 * refresh signal drops them all.
 */
const RESOLVE_TTL_MS = 10_000
const MAX_ENTRIES = 500

const entries = () => storeCaches().resolve

export function keptResolution(path: string, now = Date.now()): Resolution | null {
  const hit = entries().get(path)
  if (!hit) {
    return null
  }
  if (hit.until <= now) {
    entries().delete(path)
    return null
  }
  return hit.value as Resolution
}

export function keepResolution(path: string, resolution: Resolution, now = Date.now()): void {
  if (resolution.type !== "entity" && resolution.type !== "not_found") {
    return
  }
  const map = entries()
  map.set(path, { until: now + RESOLVE_TTL_MS, value: resolution })
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

/** Drops every kept answer (the refresh signal). */
export function forgetResolutions(): void {
  entries().clear()
}
