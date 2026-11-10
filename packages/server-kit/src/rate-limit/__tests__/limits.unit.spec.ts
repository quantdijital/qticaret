import { retryAfterSeconds } from "../limits"
import type { RateLimitProfile } from "../limits"
import { createMemoryStore } from "../store"

const profile: RateLimitProfile = {
  name: "login",
  perIp: { max: 3, windowMs: 60_000 },
  perIdentity: { max: 2, windowMs: 60_000 },
}

describe("retryAfterSeconds", () => {
  it("lets requests through within the limit and names the wait once over it", async () => {
    let now = 0
    const store = createMemoryStore(() => now)
    const check = () => retryAfterSeconds({ store, profile, ip: "203.0.113.7" })

    expect(await check()).toBeNull()
    expect(await check()).toBeNull()
    expect(await check()).toBeNull()
    now = 30_000
    expect(await check()).toBe(30)
  })

  it("counts an identity per address, apart from the address's own count", async () => {
    const store = createMemoryStore()
    const check = (identityKey: string) =>
      retryAfterSeconds({ store, profile, ip: "203.0.113.7", identityKey, scale: 10 })

    expect(await check("a")).toBeNull()
    expect(await check("a")).toBeNull()
    expect(await check("a")).not.toBeNull()
    expect(await check("b")).toBeNull()
  })

  it("skips the identity limits without an identity", async () => {
    const store = createMemoryStore()
    for (let i = 0; i < 5; i += 1) {
      expect(await retryAfterSeconds({ store, profile, ip: "x", identityKey: "", scale: 10 })).toBe(
        null
      )
    }
  })

  it("multiplies only the per-IP limit", async () => {
    const store = createMemoryStore()
    const ipOnly: RateLimitProfile = { name: "p", perIp: { max: 1, windowMs: 1000 } }

    expect(await retryAfterSeconds({ store, profile: ipOnly, ip: "x", scale: 2 })).toBeNull()
    expect(await retryAfterSeconds({ store, profile: ipOnly, ip: "x", scale: 2 })).toBeNull()
    expect(await retryAfterSeconds({ store, profile: ipOnly, ip: "x", scale: 2 })).toBe(1)
  })
})
