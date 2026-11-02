/**
 * The process's shop-wide caches in one place (adr/0048 Ek 2026-11-03):
 * `shared.ts`'s answers and `edge.ts`'s site. The proxy and the route
 * handlers are bundled apart and may each hold their own copy of a
 * module; a module variable cleared by the refresh route would leave the
 * proxy's copy standing. Kept on the process's global object under a
 * registered symbol, every bundle sees the same maps.
 */
export interface CacheEntry {
  until: number
  value: unknown
}

export interface StoreCaches {
  /** `shared.ts`: `<path>?<query JSON>` → the answer (a promise). */
  shared: Map<string, CacheEntry>
  /** `edge.ts`: the site's edge facts, under `site`. */
  edge: Map<string, CacheEntry>
}

const KEY = Symbol.for("qticaret.store-cache")

export function storeCaches(): StoreCaches {
  const holder = globalThis as unknown as Record<symbol, StoreCaches | undefined>
  let caches = holder[KEY]
  if (!caches) {
    caches = { shared: new Map(), edge: new Map() }
    holder[KEY] = caches
  }
  return caches
}
