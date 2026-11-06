import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isPageRead, noteRateLimited, rateLimitedFor, waitSecondsOf } from "../busy"
import { storeCaches } from "../registry"

vi.mock("../../env", () => ({
  storefrontEnv: () => ({
    MEDUSA_BACKEND_URL: "http://backend.test",
    STOREFRONT_ORIGIN: "http://shop.test",
  }),
}))
vi.mock("../publishable-key", () => ({ publishableKey: () => Promise.resolve("pk_test1234") }))

const { storeRequest } = await import("../core")

const NOW = Date.parse("2026-11-06T12:00:00Z")

/** The backend's rate limit as the proxy's 503 (docs/21 2026-11-06, 10). */
describe("the visitors the backend's rate limit holds back", () => {
  beforeEach(() => {
    storeCaches().busy.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads Retry-After as seconds or a date, within 1 and 300, 30 without one", () => {
    expect(waitSecondsOf("12", NOW)).toBe(12)
    expect(waitSecondsOf("0", NOW)).toBe(1)
    expect(waitSecondsOf("86400", NOW)).toBe(300)
    expect(waitSecondsOf(new Date(NOW + 20_000).toUTCString(), NOW)).toBe(20)
    expect(waitSecondsOf(null, NOW)).toBe(30)
    expect(waitSecondsOf("yarın", NOW)).toBe(30)
  })

  it("holds a visitor until the wait is over, each visitor alone", () => {
    noteRateLimited("203.0.113.9", "10", NOW)
    expect(rateLimitedFor("203.0.113.9", NOW + 1_500)).toBe(9)
    expect(rateLimitedFor("198.51.100.1", NOW)).toBeNull()
    expect(rateLimitedFor("203.0.113.9", NOW + 10_000)).toBeNull()
    // Without a signed address the backend counts the storefront's own
    noteRateLimited(null, "5", NOW)
    expect(rateLimitedFor(null, NOW)).toBe(5)
  })

  it("counts reads only, never a form's own limit or the live search's", () => {
    expect(isPageRead("GET", "/store/listings/products")).toBe(true)
    expect(isPageRead("GET", "/store/seo/resolve")).toBe(true)
    expect(isPageRead("POST", "/store/contact")).toBe(false)
    expect(isPageRead("GET", "/store/listings/suggest")).toBe(false)
    expect(isPageRead("GET", "/store/maintenance/bypass/abc")).toBe(false)
  })

  it("is noted by a read the backend answers 429, with its Retry-After", async () => {
    const limited = () =>
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            new Response(JSON.stringify({ message: "errors.too_many_requests" }), {
              status: 429,
              headers: { "content-type": "application/json", "retry-after": "17" },
            })
          )
        )
      )
    limited()
    await expect(
      storeRequest("/store/listings/products", { visitorIp: "203.0.113.9" })
    ).rejects.toMatchObject({ status: 429 })
    expect(rateLimitedFor("203.0.113.9")).toBeGreaterThanOrEqual(16)

    limited()
    await expect(
      storeRequest("/store/contact", { method: "POST", body: {}, visitorIp: "198.51.100.1" })
    ).rejects.toMatchObject({ status: 429 })
    expect(rateLimitedFor("198.51.100.1")).toBeNull()
  })
})
