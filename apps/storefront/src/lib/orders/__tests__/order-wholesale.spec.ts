import { afterEach, describe, expect, it, vi } from "vitest"

// No session, the backend at a test address; its answers as each test sets them
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () => Promise.resolve({ get: () => undefined }),
}))
vi.mock("@/lib/env", () => ({
  storefrontEnv: () => ({
    MEDUSA_BACKEND_URL: "http://backend.test",
    STOREFRONT_ORIGIN: "http://shop.test",
  }),
}))
vi.mock("@/lib/store-api/publishable-key", () => ({
  publishableKey: () => Promise.resolve("pk_test1234"),
}))

const { orderSoldAtRetail } = await import("../order")

const ORDER = "order_01K0000000000000000000ORDER"
const TOKEN = `abc123.${"x".repeat(43)}`

const answer = (body: unknown, status = 200) => {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    )
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}

/** ADR-0068 slice 5 review L2: the purchase's amounts are the order's to allow. */
describe("orderSoldAtRetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("asks the order with its key, signed out, never from a cache", async () => {
    const fetch = answer({ wholesale: false })
    await expect(orderSoldAtRetail(ORDER, TOKEN)).resolves.toBe(true)
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url instanceof URL ? url.href : url).toBe(
      `http://backend.test/store/orders/${ORDER}/wholesale`
    )
    expect(init).toMatchObject({ method: "GET", cache: "no-store" })
    expect(init?.headers).toMatchObject({ "x-order-token": TOKEN })
  })

  it("is a no for a wholesale order opened with no session", async () => {
    answer({ wholesale: true })
    await expect(orderSoldAtRetail(ORDER, TOKEN)).resolves.toBe(false)
  })

  it("is a no when the backend will not say: no amounts is the safe way", async () => {
    answer({ message: "orders.unknown" }, 404)
    await expect(orderSoldAtRetail(ORDER, TOKEN)).resolves.toBe(false)
    answer({ message: "errors.internal" }, 500)
    await expect(orderSoldAtRetail(ORDER, TOKEN)).resolves.toBe(false)
    answer({})
    await expect(orderSoldAtRetail(ORDER, null)).resolves.toBe(false)
  })
})
