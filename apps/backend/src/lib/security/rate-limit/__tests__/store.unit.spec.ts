import { randomUUID } from "node:crypto"
import { createMemoryStore, createRedisStore, withFallback } from "../store"
import type { RateLimitStore } from "../store"

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
    return { hit }
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
    const primary = { hit: jest.fn(() => Promise.resolve({ count: 7, resetMs: 10 })) }
    const store = withFallback(primary, createMemoryStore())

    expect(await store.hit("k", 1000)).toEqual({ count: 7, resetMs: 10 })
  })
})

// Runs against a real Redis when TEST_REDIS_URL is set (locally:
// TEST_REDIS_URL=redis://localhost:6379/15); CI has no Redis service yet
const redisUrl = process.env["TEST_REDIS_URL"]
const withRedis = redisUrl === undefined ? describe.skip : describe

withRedis("createRedisStore", () => {
  let store: RateLimitStore

  beforeAll(async () => {
    store = createRedisStore(redisUrl ?? "", `qt:test:${randomUUID()}:`)
    await store.ready?.()
  })

  afterAll(async () => {
    await store.close?.()
  })

  it("counts atomically with an expiry set on the first hit", async () => {
    const first = await store.hit("k", 2000)
    const second = await store.hit("k", 2000)

    expect(first.count).toBe(1)
    expect(second.count).toBe(2)
    expect(second.resetMs).toBeGreaterThan(0)
    expect(second.resetMs).toBeLessThanOrEqual(2000)
  })

  it("starts over once the window expires", async () => {
    await store.hit("short", 50)
    await new Promise((resolve) => setTimeout(resolve, 120))

    expect((await store.hit("short", 50)).count).toBe(1)
  })
})
