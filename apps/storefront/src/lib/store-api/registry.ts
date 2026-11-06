/**
 * The process's shop-wide caches in one place (adr/0048 Ek 2026-11-03):
 * `shared.ts`'s answers, `edge.ts`'s site and `resolutions.ts`'s
 * resolve answers. The proxy and the route
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
  /** `resolutions.ts`: a path as the storefront sends it → its resolve answer. */
  resolve: Map<string, CacheEntry>
  /** `busy.ts`: a visitor the backend's rate limit refused → until when its pages wait. */
  busy: Map<string, CacheEntry>
}

const KEY = Symbol.for("qticaret.store-cache")

export function storeCaches(): StoreCaches {
  const holder = globalThis as unknown as Record<symbol, Partial<StoreCaches> | undefined>
  const caches = (holder[KEY] ??= {})
  // A holder an older bundle of this process made may lack a newer map
  caches.shared ??= new Map()
  caches.edge ??= new Map()
  caches.resolve ??= new Map()
  caches.busy ??= new Map()
  return caches as StoreCaches
}
