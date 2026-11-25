import { EventEmitter } from "node:events"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createMemoryStore } from "@qticaret/server-kit"
import type { RateLimitProfile } from "@qticaret/server-kit"
import {
  addressRequestsInFlight,
  holdAddressSlot,
  resetAddressInFlight,
  tuneAddressInFlight,
} from "../address-in-flight"
import { releaseVerifiedAddressSlot, tenantApiAddressLimit } from "../tenant-api-address"

// The guard's verdict, as the test sets it
const mockVerified = new WeakSet<object>()
jest.mock("../tenant-api", () => ({
  tenantCallerOf: (req: object) =>
    mockVerified.has(req) ? { tenantId: "t1", kid: "k1", nonce: "n1" } : null,
}))

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
const PROFILE: RateLimitProfile = { name: "t_addr", perIp: { max: 3, windowMs: 60_000 } }

function request(ip = "203.0.113.7") {
  return {
    originalUrl: "/tenant-api/v1/ai/credits",
    method: "GET",
    ip,
    socket: {},
    headers: {},
    scope: { resolve: () => logger },
  } as unknown as MedusaRequest
}

function response() {
  const state: { status?: number; headers: Record<string, string> } = { headers: {} }
  const res = Object.assign(new EventEmitter(), {
    headersSent: false,
    setHeader: (name: string, value: string) => (state.headers[name.toLowerCase()] = value),
    removeHeader: () => undefined,
    status(code: number) {
      state.status = code
      return res
    },
    json: () => res,
  })
  return { res, state }
}

/**
 * PR #371 D4: before the signature, an address is counted only for what
 * no shop's signature vouched for; a verified shop's requests count in
 * its own bucket after the guard, never in the address's.
 */
describe("tenantApiAddressLimit", () => {
  const settle = () => new Promise((resolve) => setImmediate(resolve))

  async function send(limit: ReturnType<typeof tenantApiAddressLimit>, ip?: string) {
    const { res, state } = response()
    const next = jest.fn()
    await limit(request(ip), res as unknown as MedusaResponse, next)
    res.emit("close")
    await settle()
    return { passed: next.mock.calls.length === 1, state }
  }

  it("never counts a verified shop's requests against its address", async () => {
    const store = createMemoryStore()
    const limit = tenantApiAddressLimit({
      profile: PROFILE,
      store: () => store,
      verified: () => true,
    })
    for (let i = 0; i < 20; i += 1) {
      expect((await send(limit)).passed).toBe(true)
    }
    expect(await store.peek("t_addr:ip:203.0.113.7")).toBe(0)
  })

  it("counts what was refused, and holds the address once its budget is spent", async () => {
    const store = createMemoryStore()
    let signed = false
    const limit = tenantApiAddressLimit({
      profile: PROFILE,
      store: () => store,
      verified: () => signed,
    })
    for (let i = 0; i < 3; i += 1) {
      expect((await send(limit)).passed).toBe(true)
    }
    const held = await send(limit)
    expect(held.passed).toBe(false)
    expect(held.state.status).toBe(429)
    expect(held.state.headers["retry-after"]).toBe("60")
    // Held for a signed request too: the address spent its budget on refusals
    signed = true
    expect((await send(limit)).passed).toBe(false)
    // Another address is its own
    expect((await send(limit, "198.51.100.9")).passed).toBe(true)
  })

  describe("requests in flight (PR #374 review Y1)", () => {
    afterEach(() => {
      tuneAddressInFlight(null)
      resetAddressInFlight()
    })

    async function open(limit: ReturnType<typeof tenantApiAddressLimit>, ip?: string) {
      const { res, state } = response()
      const next = jest.fn()
      const req = request(ip)
      await limit(req, res as unknown as MedusaResponse, next)
      return { req, res, state, passed: next.mock.calls.length === 1 }
    }

    it("refuses the request past the cap before the store is asked", async () => {
      tuneAddressInFlight(2)
      const store = createMemoryStore()
      const peek = jest.spyOn(store, "peek")
      const limit = tenantApiAddressLimit({
        profile: PROFILE,
        store: () => store,
        verified: () => false,
      })
      const first = await open(limit)
      const held = [first, await open(limit)]
      expect(held.every((each) => each.passed)).toBe(true)
      expect(addressRequestsInFlight()).toBe(2)
      const third = await open(limit)
      expect(third.passed).toBe(false)
      expect(third.state.status).toBe(429)
      expect(peek).toHaveBeenCalledTimes(2)
      // Another address is its own
      expect((await open(limit, "198.51.100.9")).passed).toBe(true)
      // One answer over, finish and close both: its slot back once
      first.res.emit("finish")
      first.res.emit("close")
      first.res.emit("close")
      expect(addressRequestsInFlight()).toBe(2)
      expect((await open(limit)).passed).toBe(true)
      expect((await open(limit)).passed).toBe(false)
    })

    it("gives a slot back once the guard verified the request, and not twice", async () => {
      tuneAddressInFlight(1)
      const limit = tenantApiAddressLimit({ profile: PROFILE, store: () => createMemoryStore() })
      const first = await open(limit)
      expect(first.passed).toBe(true)
      // Not verified: the release step keeps the slot
      const next = jest.fn()
      releaseVerifiedAddressSlot(first.req, first.res as unknown as MedusaResponse, next)
      expect(next).toHaveBeenCalledTimes(1)
      expect(addressRequestsInFlight()).toBe(1)
      expect((await open(limit)).passed).toBe(false)
      // Verified: given back at once, and the answer's end gives nothing more
      mockVerified.add(first.req)
      releaseVerifiedAddressSlot(first.req, first.res as unknown as MedusaResponse, next)
      expect(addressRequestsInFlight()).toBe(0)
      const second = await open(limit)
      expect(second.passed).toBe(true)
      first.res.emit("close")
      expect(addressRequestsInFlight()).toBe(1)
      second.res.emit("close")
      expect(addressRequestsInFlight()).toBe(0)
    })

    it("lets every caller release a slot only once", () => {
      const release = holdAddressSlot("a", 1)
      expect(release).not.toBeNull()
      expect(holdAddressSlot("a", 1)).toBeNull()
      const other = holdAddressSlot("b", 1)
      release?.()
      release?.()
      expect(addressRequestsInFlight("a")).toBe(0)
      expect(addressRequestsInFlight("b")).toBe(1)
      expect(addressRequestsInFlight()).toBe(1)
      other?.()
      expect(addressRequestsInFlight()).toBe(0)
    })
  })

  it("lets a request through when the store fails", async () => {
    const limit = tenantApiAddressLimit({
      profile: PROFILE,
      store: () => ({
        hit: () => Promise.reject(new Error("down")),
        peek: () => Promise.reject(new Error("down")),
      }),
      verified: () => false,
    })
    expect((await send(limit)).passed).toBe(true)
    expect(logger.error).toHaveBeenCalled()
  })
})
