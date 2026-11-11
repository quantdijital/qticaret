import { RedisNonceStore } from "../nonce-store"
import type { NonceRedisClient } from "../nonce-store"

/** A Redis double answering `SET NX EX` as Redis does, with its own clock. */
function fakeRedis(now: () => number) {
  const keys = new Map<string, number>()
  const calls: unknown[][] = []
  const client: NonceRedisClient = {
    set: (key, value, ex, seconds, nx) => {
      calls.push([key, value, ex, seconds, nx])
      const until = keys.get(key)
      if (until !== undefined && until > now()) {
        return Promise.resolve(null)
      }
      keys.set(key, now() + seconds * 1000)
      return Promise.resolve("OK")
    },
  }
  return { client, calls }
}

describe("RedisNonceStore (adr/0061 Ek C9)", () => {
  it("claims a nonce once, atomically with its expiry, under its prefix", async () => {
    let now = 0
    const { client, calls } = fakeRedis(() => now)
    const store = new RedisNonceStore(client, "qt:t:nonce:")

    expect(await store.claim("ten_1:abc", 600)).toBe(true)
    expect(await store.claim("ten_1:abc", 600)).toBe(false)
    expect(await store.claim("ten_2:abc", 600)).toBe(true)
    expect(calls[0]).toEqual(["qt:t:nonce:ten_1:abc", "1", "EX", 600, "NX"])

    now = 601_000
    expect(await store.claim("ten_1:abc", 600)).toBe(true)
  })

  it("throws when Redis fails, so the caller refuses rather than accepts", async () => {
    const store = new RedisNonceStore({ set: () => Promise.reject(new Error("down")) })

    await expect(store.claim("ten_1:abc", 600)).rejects.toThrow("down")
  })

  it("refuses a time to live that is not a positive whole number", async () => {
    const store = new RedisNonceStore(fakeRedis(() => 0).client)

    await expect(store.claim("k", 0)).rejects.toThrow(RangeError)
    await expect(store.claim("k", 1.5)).rejects.toThrow(RangeError)
  })
})
