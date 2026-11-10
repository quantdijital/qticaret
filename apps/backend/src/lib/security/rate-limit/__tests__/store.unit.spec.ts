import { randomUUID } from "node:crypto"
import { createRedisStore } from "../store"
import type { RateLimitStore } from "../store"

// The memory and fallback stores are tested in @qticaret/server-kit (adr/0061, C3)

// Runs against a real Redis when TEST_REDIS_URL is set: CI's quality job
// has a Redis service; locally TEST_REDIS_URL=redis://localhost:56379/15
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

  it("reads a count without adding to it", async () => {
    await store.hit("peeked", 2000)

    expect(await store.peek("peeked")).toBe(1)
    expect(await store.peek("peeked")).toBe(1)
    expect(await store.peek("never")).toBe(0)
  })

  it("starts over once the window expires", async () => {
    await store.hit("short", 50)
    await new Promise((resolve) => setTimeout(resolve, 120))

    expect((await store.hit("short", 50)).count).toBe(1)
  })
})
