import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../env", () => ({
  storefrontEnv: () => ({
    MEDUSA_BACKEND_URL: "http://backend.test",
    STOREFRONT_ORIGIN: "http://shop.test",
  }),
}))
vi.mock("../publishable-key", () => ({ publishableKey: () => Promise.resolve("pk_test1234") }))

const { storeRequest } = await import("../core")
const { WHOLESALE_PRICES_PATH } = await import("../wholesale-prices")

/** ADR-0068 §7: a wholesaler's prices never rest in Next's fetch cache. */
describe("the wholesaler's own calls", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("go out with Next's cache off and the customer's key", async () => {
    const fetched = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response(JSON.stringify({ wholesale_prices: {} }), { status: 200 }))
    )
    vi.stubGlobal("fetch", fetched)
    for (const path of [WHOLESALE_PRICES_PATH, "/store/customers/me/wholesale"]) {
      await storeRequest(path, {
        visitorIp: null,
        query: { variant_id: ["variant_a"] },
        headers: { authorization: "Bearer h.p.s" },
      })
    }
    for (const [url, init] of fetched.mock.calls) {
      expect(url.pathname.startsWith("/store/customers/me/")).toBe(true)
      expect(init.cache).toBe("no-store")
      expect(init).not.toHaveProperty("next")
      expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer h.p.s")
    }
    expect(fetched).toHaveBeenCalledTimes(2)
  })
})
