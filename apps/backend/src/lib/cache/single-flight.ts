/**
 * Concurrent callers asking for the same key share one running
 * computation; nothing is kept once it settles, so the next call reads
 * fresh. For heavy admin reads (docs/04): ten tabs refreshing at once cost
 * one database read, not ten.
 */
export function createSingleFlight<T>() {
  const running = new Map<string, Promise<T>>()
  return (key: string, run: () => Promise<T>): Promise<T> => {
    const current = running.get(key)
    if (current) {
      return current
    }
    const promise = run().finally(() => {
      running.delete(key)
    })
    running.set(key, promise)
    return promise
  }
}
