import type { MedusaRequest } from "@medusajs/framework/http"
import { logger } from "../../../lib/logging"
import type { TransportResponse } from "../../../lib/clients"
import { solveChallenge } from "../../../lib/security/challenge"
import { createMemoryStore } from "../../../lib/security/rate-limit"
import { TURNSTILE_DUMMY_TOKEN, createTurnstileClient } from "../../../lib/security/turnstile"
import { requireTurnstile, resetTurnstile, shopHostnames, turnstileOver } from "../turnstile"
import { parseEnv } from "../../../lib/env"
import { fakeResponse } from "./fakes"

let now = 0
const store = createMemoryStore(() => now)

jest.mock("../rate-limit", () => ({
  sharedRateLimitStore: () => store,
  clientBucket: () => "203.0.113.0",
}))

// Made-up values in Cloudflare's shape, for these fakes only
const SITE = "0x4AAAAAAAmadeUpSiteKeyForUnit"
const SECRET = "0x4AAAAAAAmadeUpSecretForUnitTests"

interface Answer {
  message?: string
  challenge?: { token: string; salt: string; bits: number }
}

function request(
  headers: Record<string, string>,
  settings: () => Promise<unknown> = () => Promise.resolve({ canonical_host: "magaza.example" })
): MedusaRequest {
  return {
    path: "/auth/customer/emailpass",
    originalUrl: "/auth/customer/emailpass",
    method: "POST",
    headers,
    ip: "203.0.113.9",
    socket: {},
    body: {},
    scope: { resolve: () => ({ getSection: settings }) },
  } as unknown as MedusaRequest
}

async function run(
  middleware: ReturnType<typeof requireTurnstile>,
  headers: Record<string, string>
): Promise<{ status: number; body: Answer }> {
  const response = fakeResponse()
  const next = jest.fn<undefined, unknown[]>()
  await middleware(request(headers), response.res, next)
  // Never an error handed on
  expect(next.mock.calls.every((call) => call.length === 0)).toBe(true)
  return {
    status: next.mock.calls.length > 0 ? 0 : response.status(),
    body: response.body() as Answer,
  }
}

const cloudflare = (answer: () => Promise<TransportResponse>) =>
  createTurnstileClient({ sleep: () => Promise.resolve(), transport: answer })

const says = (body: unknown) => () =>
  Promise.resolve({ status: 200, header: () => null, text: JSON.stringify(body) })

const before = { ...process.env }

beforeEach(() => {
  now += 24 * 60 * 60 * 1000
  delete process.env["TURNSTILE_SITE_KEY"]
  delete process.env["TURNSTILE_SECRET_KEY"]
  resetTurnstile()
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
  jest.spyOn(logger, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  process.env = { ...before }
  resetTurnstile()
  jest.restoreAllMocks()
})

describe("requireTurnstile (adr/0044 Ek 2026-11-24)", () => {
  it("asks a token, refuses a bad one and lets the test token through (test keys by default)", async () => {
    const gate = requireTurnstile("login")
    const missing = await run(gate, {})
    const bad = await run(gate, { "x-turnstile-token": "not-the-dummy" })

    expect([missing.status, missing.body]).toEqual([
      428,
      expect.objectContaining({
        message: "fraud.turnstile_required",
        turnstile: { action: "login" },
      }),
    ])
    expect([bad.status, bad.body.message]).toEqual([403, "fraud.turnstile_failed"])
    expect((await run(gate, { "x-turnstile-token": TURNSTILE_DUMMY_TOKEN })).status).toBe(0)
  })

  it("passes a real key's token for this gate and host once, never twice", async () => {
    process.env["TURNSTILE_SITE_KEY"] = SITE
    process.env["TURNSTILE_SECRET_KEY"] = SECRET
    resetTurnstile(cloudflare(says({ success: true, action: "login", hostname: "magaza.example" })))
    const gate = requireTurnstile("login")

    expect((await run(gate, { "x-turnstile-token": "tok-1" })).status).toBe(0)
    const again = await run(gate, { "x-turnstile-token": "tok-1" })
    expect([again.status, again.body.message]).toEqual([403, "fraud.turnstile_failed"])
    // Another gate's action is refused
    const other = await run(requireTurnstile("register"), { "x-turnstile-token": "tok-2" })
    expect(other.status).toBe(403)
  })

  it("falls back to a proof of work of its own when Cloudflare cannot answer", async () => {
    process.env["TURNSTILE_SITE_KEY"] = SITE
    process.env["TURNSTILE_SECRET_KEY"] = SECRET
    resetTurnstile(cloudflare(() => Promise.reject(new Error("timeout"))))
    const gate = requireTurnstile("checkout")

    const asked = await run(gate, { "x-turnstile-token": "tok-3" })
    expect([asked.status, asked.body]).toEqual([
      428,
      expect.objectContaining({
        message: "fraud.challenge_required",
        fallback: "turnstile_unavailable",
      }),
    ])
    const challenge = asked.body.challenge
    if (!challenge) {
      throw new Error("no challenge")
    }
    expect(challenge.token.startsWith("ts_checkout.")).toBe(true)
    const answer = `${challenge.token}.${solveChallenge(challenge.salt, challenge.bits)}`

    expect((await run(gate, { "x-turnstile-fallback": answer })).status).toBe(0)
    expect((await run(gate, { "x-turnstile-fallback": answer })).status).toBe(428)
    // Another gate's fallback, or the answer in the adaptive proof's header, does not stand in
    expect((await run(requireTurnstile("login"), { "x-turnstile-fallback": answer })).status).toBe(
      428
    )
    expect((await run(gate, { "x-challenge": answer })).status).toBe(428)
  })

  it("asks nothing while a developer turned it off", async () => {
    process.env["TURNSTILE"] = "off"
    expect((await run(requireTurnstile("login"), {})).status).toBe(0)
  })

  it("lets anything but a POST through", async () => {
    const response = fakeResponse()
    const next = jest.fn()
    await requireTurnstile("login")(
      { ...request({}), method: "GET" } as MedusaRequest,
      response.res,
      next
    )
    expect(next).toHaveBeenCalledWith()
  })
})

describe("turnstileOver", () => {
  it("asks nothing below the soft limit, Turnstile past it", async () => {
    const gate = turnstileOver("newsletter", { max: 2, windowMs: 60_000 })
    const statuses = []
    for (let n = 0; n < 3; n++) {
      statuses.push((await run(gate, {})).status)
    }
    const withToken = await run(gate, { "x-turnstile-token": TURNSTILE_DUMMY_TOKEN })

    expect(statuses).toEqual([0, 0, 428])
    expect(withToken.status).toBe(0)
  })
})

describe("shopHostnames", () => {
  it("takes the shop's domain and its www twin, the origins, and locally localhost", async () => {
    const hosts = await shopHostnames(request({}), parseEnv())
    expect([...hosts]).toEqual(
      expect.arrayContaining(["magaza.example", "www.magaza.example", "localhost"])
    )
    const www = await shopHostnames(
      request({}, () => Promise.resolve({ canonical_host: "www.magaza.example" })),
      parseEnv()
    )
    expect(www.has("magaza.example")).toBe(true)
  })

  it("keeps the env's hosts when the settings cannot be read", async () => {
    jest.spyOn(logger, "error").mockImplementation(() => undefined)
    const hosts = await shopHostnames(
      request({}, () => Promise.reject(new Error("db down"))),
      parseEnv({ ...process.env, TURNSTILE_ALLOWED_HOSTNAMES: "onizleme.example" })
    )
    expect(hosts.has("onizleme.example")).toBe(true)
    expect(hosts.has("magaza.example")).toBe(false)
  })
})
