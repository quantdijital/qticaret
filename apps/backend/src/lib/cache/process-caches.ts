/**
 * What a process holds between requests, as one list, under tests only.
 *
 * The HTTP integration suite can run several spec files on one app boot
 * (integration-tests/bundle): between two files the database goes back to
 * where it started, and everything held in process must go with it, or a
 * file reads the last one's settings, provider clients or counters. Each
 * holder registers how it forgets; the suite forgets them all between files,
 * as a fresh process would have.
 *
 * Outside NODE_ENV=test nothing registers: a running shop never forgets on
 * purpose.
 */

const REGISTRY = Symbol.for("qticaret.process-caches")

interface Entry {
  forget: () => void
  /** A cache made by a factory is held weakly: dropped, it leaves the list. */
  owner: WeakRef<object> | null
}

// On the global object: a test run that loads a module twice still keeps one list
function registry(): Set<Entry> {
  const holder = globalThis as unknown as Record<symbol, Set<Entry> | undefined>
  let list = holder[REGISTRY]
  if (!list) {
    list = new Set()
    holder[REGISTRY] = list
  }
  return list
}

/**
 * Registers how a process-held value is forgotten (tests only). `owner`, the
 * cache object itself, for caches a factory makes; none for a module's own
 * value, which lives as long as the process.
 */
export function registerProcessCache(forget: () => void, owner?: object): void {
  if (process.env["NODE_ENV"] !== "test") {
    return
  }
  registry().add({ forget, owner: owner ? new WeakRef(owner) : null })
}

/** Forgets every registered value; returns how many there were. */
export function forgetProcessCaches(): number {
  const list = registry()
  let count = 0
  for (const entry of list) {
    if (entry.owner && !entry.owner.deref()) {
      list.delete(entry)
      continue
    }
    entry.forget()
    count += 1
  }
  return count
}
