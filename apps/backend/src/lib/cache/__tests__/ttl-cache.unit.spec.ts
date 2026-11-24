import { createTtlCache } from "../ttl-cache"

describe("createTtlCache", () => {
  it("loads a key once while it is fresh, shared by callers at once", async () => {
    let clock = 0
    const cache = createTtlCache<number>({ ttlMs: 100, maxEntries: 10, now: () => clock })
    let loads = 0
    const load = () => Promise.resolve(++loads)

    expect(await Promise.all([cache("a", load), cache("a", load)])).toEqual([1, 1])
    clock = 99
    expect(await cache("a", load)).toBe(1)
    clock = 100
    expect(await cache("a", load)).toBe(2)
  })

  it("keeps at most its size, dropping the oldest", async () => {
    const cache = createTtlCache<string>({ ttlMs: 1000, maxEntries: 2, now: () => 0 })
    const loads: string[] = []
    const load = (key: string) => () => {
      loads.push(key)
      return Promise.resolve(key)
    }
    await cache("a", load("a"))
    await cache("b", load("b"))
    await cache("c", load("c"))
    await cache("b", load("b"))
    await cache("a", load("a"))

    expect(loads).toEqual(["a", "b", "c", "a"])
  })

  it("does not keep a failed load", async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 2, now: () => 0 })
    await expect(cache("a", () => Promise.reject(new Error("down")))).rejects.toThrow("down")
    expect(await cache("a", () => Promise.resolve(3))).toBe(3)
  })

  it("forgets every value when cleared", async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000, maxEntries: 2, now: () => 0 })
    await cache("a", () => Promise.resolve(1))
    cache.clear()
    expect(await cache("a", () => Promise.resolve(2))).toBe(2)
  })
})
