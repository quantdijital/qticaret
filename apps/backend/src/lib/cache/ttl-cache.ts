/**
 * A few values held in process for a short time, each loaded once however
 * many callers ask at once (docs/05): a heavy read many requests share,
 * where an answer up to `ttlMs` old is fine. At most `maxEntries` are kept;
 * the oldest goes first. A failed load is not kept.
 */
export function createTtlCache<T>({
  ttlMs,
  maxEntries,
  now = Date.now,
}: {
  ttlMs: number
  maxEntries: number
  now?: () => number
}) {
  const entries = new Map<string, { until: number; value: Promise<T> }>()
  return (key: string, load: () => Promise<T>): Promise<T> => {
    const held = entries.get(key)
    if (held && held.until > now()) {
      return held.value
    }
    entries.delete(key)
    if (entries.size >= maxEntries) {
      const oldest = entries.keys().next()
      if (!oldest.done) {
        entries.delete(oldest.value)
      }
    }
    const value = load()
    const entry = { until: now() + ttlMs, value }
    entries.set(key, entry)
    value.catch(() => {
      if (entries.get(key) === entry) {
        entries.delete(key)
      }
    })
    return value
  }
}
