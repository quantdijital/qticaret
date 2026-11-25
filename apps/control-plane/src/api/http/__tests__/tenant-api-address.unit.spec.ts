import { EventEmitter } from "node:events"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createMemoryStore } from "@qticaret/server-kit"
import type { RateLimitProfile } from "@qticaret/server-kit"
import { tenantApiAddressLimit } from "../tenant-api-address"

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
