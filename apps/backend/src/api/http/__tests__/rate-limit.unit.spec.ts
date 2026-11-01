import type { MedusaRequest } from "@medusajs/framework/http"
import { logger } from "../../../lib/logging"
import { RATE_LIMIT_PROFILES, createMemoryStore } from "../../../lib/security/rate-limit"
import type { RateLimitProfile, RateLimitStore } from "../../../lib/security/rate-limit"
import { authIdentity, authProfile, rateLimit, rateLimitPrefix } from "../rate-limit"
import { fakeResponse } from "./fakes"

const request = (fields: { path?: string; ip?: string; body?: unknown } = {}) =>
  ({
    path: "/",
    originalUrl: fields.path ?? "/auth/customer/emailpass",
    method: "POST",
    ip: fields.ip ?? "203.0.113.7",
    // Every real request has headers: the signed-address check reads them
    headers: {},
    socket: {},
    body: fields.body ?? {},
    requestId: "req-12345678",
  }) as unknown as MedusaRequest

const PROFILE = {
  name: "test",
  perIp: { max: 3, windowMs: 60_000 },
  perIdentity: { max: 2, windowMs: 60_000 },
}

async function run(middleware: ReturnType<typeof rateLimit>, req: MedusaRequest) {
  const response = fakeResponse()
  const next = jest.fn()
  await middleware(req, response.res, next)
  return { ...response, next }
}

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
  jest.spyOn(logger, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("rateLimit", () => {
  it("lets requests within the limits through", async () => {
    const store = createMemoryStore()
    const limiter = rateLimit(() => PROFILE, {
      store: () => store,
      identity: authIdentity,
      scale: 1,
    })

    const result = await run(limiter, request({ body: { email: "a@example.com" } }))

    expect(result.next).toHaveBeenCalledWith()
  })

  it("answers 429 with Retry-After once an identity is over its limit", async () => {
    const store = createMemoryStore()
    const limiter = rateLimit(() => PROFILE, {
      store: () => store,
      identity: authIdentity,
      scale: 1,
    })
    const req = () => request({ body: { email: "A@Example.com " } })

    await run(limiter, req())
    await run(limiter, req())
    const third = await run(limiter, req())

    expect(third.next).not.toHaveBeenCalled()
    expect(third.status()).toBe(429)
    expect(Number(third.headers["retry-after"])).toBeGreaterThan(0)
    expect(third.body()).toMatchObject({
      type: "too_many_requests",
      message: "errors.too_many_requests",
    })
  })

  it("counts identities apart and the address across them", async () => {
    const store = createMemoryStore()
    const limiter = rateLimit(() => PROFILE, {
      store: () => store,
      identity: authIdentity,
      scale: 1,
    })

    await run(limiter, request({ body: { email: "a@example.com" } }))
    await run(limiter, request({ body: { email: "b@example.com" } }))
    await run(limiter, request({ body: { email: "c@example.com" } }))
    const fourth = await run(limiter, request({ body: { email: "d@example.com" } }))

    expect(fourth.status()).toBe(429)
    const other = await run(
      limiter,
      request({ ip: "198.51.100.9", body: { email: "a@example.com" } })
    )
    expect(other.next).toHaveBeenCalled()
  })

  it("counts an identity a client holds from every address together, when the profile says so", async () => {
    const store = createMemoryStore()
    const cartProfile: RateLimitProfile = {
      name: "cart",
      perIdentity: { max: 5, windowMs: 60_000 },
      perIdentityAnyIp: { max: 2, windowMs: 60_000 },
    }
    const limiter = rateLimit(() => cartProfile, {
      store: () => store,
      identity: () => "cart_01ABC",
      scale: 1,
    })
    await run(limiter, request({ ip: "203.0.113.7" }))
    await run(limiter, request({ ip: "198.51.100.9" }))
    const third = await run(limiter, request({ ip: "192.0.2.44" }))
    expect(third.status()).toBe(429)
  })

  it("never stores the identity as it is", async () => {
    const keys: string[] = []
    const store: RateLimitStore = {
      hit: (key) => {
        keys.push(key)
        return Promise.resolve({ count: 1, resetMs: 1000 })
      },
      peek: () => Promise.resolve(0),
    }

    await run(
      rateLimit(() => PROFILE, { store: () => store, identity: authIdentity, scale: 1 }),
      request({ body: { email: "ayse@example.com" } })
    )

    expect(keys.join(" ")).not.toContain("ayse")
  })

  it("fails open and logs when the store is down", async () => {
    const store: RateLimitStore = {
      hit: () => Promise.reject(new Error("redis down")),
      peek: () => Promise.reject(new Error("redis down")),
    }

    const result = await run(
      rateLimit(() => PROFILE, { store: () => store }),
      request()
    )

    expect(result.next).toHaveBeenCalledWith()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "rate_limit.store_failed" })
    )
  })

  it("counts an IPv6 client by its /64, so rotating addresses does not reset the count", async () => {
    const store = createMemoryStore()
    const limiter = rateLimit(() => PROFILE, { store: () => store, scale: 1 })

    for (const suffix of ["1", "2", "3"]) {
      await run(limiter, request({ ip: `2001:db8:1:2::${suffix}` }))
    }
    const rotated = await run(limiter, request({ ip: "2001:db8:1:2:ffff::9" }))
    const otherNetwork = await run(limiter, request({ ip: "2001:db8:1:3::1" }))

    expect(rotated.status()).toBe(429)
    expect(otherNetwork.next).toHaveBeenCalled()
  })

  it("skips a request no profile covers", async () => {
    const result = await run(
      rateLimit(() => null),
      request()
    )

    expect(result.next).toHaveBeenCalledWith()
  })
})

describe("rateLimitPrefix", () => {
  it("namespaces counters by database, so tenants and test runs sharing a Redis stay apart", () => {
    expect(rateLimitPrefix("postgres://u:p@db:6432/tenant_acme")).toBe("qt:rl:db:6432/tenant_acme:")
    expect(rateLimitPrefix("postgres://localhost/medusa-01abc-integration-1")).toBe(
      "qt:rl:localhost:5432/medusa-01abc-integration-1:"
    )
    expect(rateLimitPrefix("postgres://localhost")).toBe("qt:rl:localhost:5432/default:")
  })

  it("names a test run apart from dev on the same database", () => {
    expect(rateLimitPrefix("postgres://localhost/qticaret", "test", undefined)).toBe(
      "qt:rl:localhost:5432/qticaret/test:"
    )
    expect(rateLimitPrefix("postgres://localhost/qticaret", "development", "a1b2c3d4")).toBe(
      "qt:rl:localhost:5432/qticaret:"
    )
  })

  it("gives an integration test file a run of its own, so runs never fill each other's limits", () => {
    expect(rateLimitPrefix("postgres://localhost/qticaret", "test", "a1b2c3d4")).toBe(
      "qt:rl:localhost:5432/qticaret/test/a1b2c3d4:"
    )
  })

  it("keeps a malformed escape as written instead of throwing", () => {
    expect(rateLimitPrefix("postgres://localhost/shop%zz")).toBe("qt:rl:localhost:5432/shop%zz:")
  })
})

describe("authProfile", () => {
  it.each([
    ["/auth/customer/emailpass", "login"],
    ["/auth/user/emailpass", "login"],
    ["/auth/customer/emailpass/register", "register"],
    ["/auth/customer/emailpass/reset-password", "password_reset"],
    ["/auth/token/refresh", "token_refresh"],
    ["/auth/session", "auth_default"],
    ["/auth/customer/emailpass/update", "auth_default"],
    ["/auth/customer/google/callback", "auth_default"],
    // Spellings Express routes to the same handlers
    ["/auth/customer/emailpass/", "login"],
    ["/AUTH/Customer/EmailPass", "login"],
    ["http://shop.example/auth/customer/emailpass", "login"],
    ["/auth/customer/emailpass#x", "login"],
    ["/auth/customer/emailpass/register/", "register"],
    ["/Auth/customer/emailpass/RESET-PASSWORD", "password_reset"],
    // A path the patterns do not know gets the strictest profile
    ["/auth/customer/emailpass/something/else", "login"],
  ])("classifies %s as %s", (path, name) => {
    expect(authProfile(request({ path })).name).toBe(name)
  })

  it("reads the identity from the field the route reads", () => {
    expect(authIdentity(request({ body: { email: "a@b.co" } }))).toBe("a@b.co")
    expect(authIdentity(request({ body: { email: 42 } }))).toBeUndefined()
    const reset = (body: unknown) =>
      authIdentity(request({ path: "/auth/customer/emailpass/reset-password", body }))
    expect(reset({ identifier: "c@d.co" })).toBe("c@d.co")
    // A decoy e-mail does not take the target's place in the count
    expect(reset({ identifier: "victim@d.co", email: "decoy-1@x.co" })).toBe("victim@d.co")
    // A verification request counts against the address it would mail
    const verify = (body: unknown) =>
      authIdentity(request({ path: "/auth/verification/request", body }))
    expect(verify({ entity_id: "e@f.co", email: "decoy-2@x.co" })).toBe("e@f.co")
  })

  it("defines every profile the security doc names", () => {
    expect(Object.keys(RATE_LIMIT_PROFILES)).toEqual(
      expect.arrayContaining([
        "login",
        "register",
        "password_reset",
        "checkout",
        "coupon",
        "installment",
        "sms",
        "webhook",
      ])
    )
  })
})
