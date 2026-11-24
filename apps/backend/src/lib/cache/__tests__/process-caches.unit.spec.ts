import { forgetProcessCaches, registerProcessCache } from "../process-caches"
import { createTtlCache } from "../ttl-cache"
import { createVersionedCache } from "../versioned-cache"

describe("process caches", () => {
  it("forgets what a TTL cache and a versioned cache hold", async () => {
    const ttl = createTtlCache<number>({ ttlMs: 60_000, maxEntries: 10, now: () => 0 })
    let ttlLoads = 0
    let versionedLoads = 0
    const versioned = createVersionedCache({
      name: "test",
      source: null,
      now: () => 0,
      load: () => Promise.resolve(++versionedLoads),
    })
    const loadTtl = () => Promise.resolve(++ttlLoads)

    expect([await ttl("a", loadTtl), await versioned.get()]).toEqual([1, 1])
    expect([await ttl("a", loadTtl), await versioned.get()]).toEqual([1, 1])
    expect(forgetProcessCaches()).toBeGreaterThanOrEqual(2)
    expect([await ttl("a", loadTtl), await versioned.get()]).toEqual([2, 2])
  })

  it("runs a module's own forget", () => {
    let held: string | undefined = "client"
    registerProcessCache(() => {
      held = undefined
    })
    forgetProcessCaches()
    expect(held).toBeUndefined()
  })

  it("registers nothing outside tests", () => {
    const before = forgetProcessCaches()
    const saved = process.env["NODE_ENV"]
    process.env["NODE_ENV"] = "production"
    try {
      registerProcessCache(() => undefined)
      createTtlCache<number>({ ttlMs: 1, maxEntries: 1 })
    } finally {
      process.env["NODE_ENV"] = saved
    }
    expect(forgetProcessCaches()).toBe(before)
  })
})
