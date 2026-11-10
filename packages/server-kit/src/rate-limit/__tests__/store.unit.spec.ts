import { createMemoryStore, withFallback } from "../store"

describe("createMemoryStore", () => {
  it("counts hits in a window and starts over when it ends", async () => {
    let now = 0
    const store = createMemoryStore(() => now)

    expect(await store.hit("k", 1000)).toEqual({ count: 1, resetMs: 1000 })
    now = 400
    expect(await store.hit("k", 1000)).toEqual({ count: 2, resetMs: 600 })
    now = 1000
    expect(await store.hit("k", 1000)).toEqual({ count: 1, resetMs: 1000 })
  })

  it("reads a window's count without adding to it, and nothing once it ends", async () => {
    let now = 0
    const store = createMemoryStore(() => now)

    expect(await store.peek("k")).toBe(0)
    await store.hit("k", 1000)
    await store.hit("k", 1000)
    expect(await store.peek("k")).toBe(2)
    expect(await store.peek("k")).toBe(2)
    now = 1000
    expect(await store.peek("k")).toBe(0)
  })

  it("keeps keys apart", async () => {
    const store = createMemoryStore()

    await store.hit("a", 1000)

    expect((await store.hit("b", 1000)).count).toBe(1)
  })

  it("past its cap drops the least recently used key, not the busiest", async () => {
    const store = createMemoryStore(() => 0, 2)

    await store.hit("busy", 1000)
    await store.hit("idle", 1000)
    await store.hit("busy", 1000)
    await store.hit("new", 1000)

    expect((await store.hit("busy", 1000)).count).toBe(3)
    expect((await store.hit("idle", 1000)).count).toBe(1)
  })
})

describe("withFallback", () => {
  const failing = () => {
    const hit = jest.fn(() => Promise.reject(new Error("redis down")))
    const peek = jest.fn(() => Promise.reject(new Error("redis down")))
    return { hit, peek }
  }

  it("counts in the fallback while the primary is down, and tries it again after the cooldown", async () => {
    let now = 0
    const primary = failing()
    const onError = jest.fn()
    const store = withFallback(
      primary,
      createMemoryStore(() => now),
      {
        cooldownMs: 1000,
        now: () => now,
        onError,
      }
    )

    expect((await store.hit("k", 60_000)).count).toBe(1)
    expect((await store.hit("k", 60_000)).count).toBe(2)
    expect(primary.hit).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)

    now = 1000
    await store.hit("k", 60_000)
    expect(primary.hit).toHaveBeenCalledTimes(2)
  })

  it("uses the primary while it answers", async () => {
    const primary = {
      hit: jest.fn(() => Promise.resolve({ count: 7, resetMs: 10 })),
      peek: jest.fn(() => Promise.resolve(7)),
    }
    const store = withFallback(primary, createMemoryStore())

    expect(await store.hit("k", 1000)).toEqual({ count: 7, resetMs: 10 })
    expect(await store.peek("k")).toBe(7)
  })
})
