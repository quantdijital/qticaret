import { beforeEach, describe, expect, it, vi } from "vitest"
import { SCOPE_PATHS } from "@/lib/refresh/contract"
import { StoreApiError } from "../errors"

// The session cookie as the test sets it, and the backend's answers by path
const jar = vi.hoisted(() => ({ session: undefined as string | undefined }))
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "qt_session" && jar.session ? { value: jar.session } : undefined,
    }),
}))
vi.mock("@/lib/env", () => ({ storefrontEnv: () => ({ NODE_ENV: "test" }) }))
const core = vi.hoisted(() => ({ storeRequest: vi.fn() }))
vi.mock("@/lib/store-api/core", () => core)

const { priceDisplays } = await import("../requests")
const { storeCaches } = await import("../registry")
const { WHOLESALE_PRICES_PATH } = await import("../wholesale-prices")

const token = () =>
  `h.${Buffer.from(JSON.stringify({ actor_id: "cus_1", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.s`

const PUBLIC = {
  current: "100.00",
  regular: "100.00",
  before: "120.00",
  on_sale: true,
  since: null,
  basis: "lowest_30d",
  rule_version: "tr-10d-1",
  cart_offer: { type: "percentage", value: 10, minimum: null },
}

type Call = [string, { query?: Record<string, unknown>; headers?: Record<string, string> }]

/** Answers as the backend would: `wholesale` is whether the session's customer is one. */
function backend(wholesale: boolean | "fails") {
  core.storeRequest.mockImplementation((path: string, request: Call[1]) => {
    if (path === "/store/customers/me/wholesale") {
      if (wholesale === "fails") {
        return Promise.reject(new StoreApiError(503, null, null))
      }
      return Promise.resolve({
        data: { wholesale: { active: wholesale, vat_exclusive: wholesale, min_quantity: null } },
      })
    }
    const ids = [request.query?.["variant_id"] ?? []].flat() as string[]
    if (path === WHOLESALE_PRICES_PATH) {
      return Promise.resolve({
        data: {
          wholesale_prices: Object.fromEntries(
            ids.map((id) => [id, { net: "66.67", gross: "80.00", vat_rate: 20 }])
          ),
        },
      })
    }
    if (path === "/store/price-display") {
      return Promise.resolve({
        data: { price_display: Object.fromEntries(ids.map((id) => [id, PUBLIC])) },
      })
    }
    return Promise.reject(new Error(`unexpected ${path}`))
  })
}

const paths = () => (core.storeRequest.mock.calls as Call[]).map(([path]) => path)

/** ADR-0068 §7: the one price path, and how a wholesaler's prices stay theirs. */
describe("priceDisplays", () => {
  beforeEach(() => {
    core.storeRequest.mockReset()
    jar.session = undefined
    storeCaches().shared.clear()
  })

  it("asks a guest's prices of the public display only, never about wholesale", async () => {
    backend(true)
    await expect(priceDisplays(["variant_a"])).resolves.toEqual({ variant_a: PUBLIC })
    expect(paths()).toEqual(["/store/price-display"])
    expect(JSON.stringify(core.storeRequest.mock.calls)).not.toContain("66.67")
  })

  it("gives a signed-in customer who is not a wholesaler the public display", async () => {
    jar.session = token()
    backend(false)
    await expect(priceDisplays(["variant_a"])).resolves.toEqual({ variant_a: PUBLIC })
    expect(paths()).toEqual(["/store/customers/me/wholesale", "/store/price-display"])
  })

  it("reads a wholesaler's own prices with their key, as one price without KDV", async () => {
    jar.session = token()
    backend(true)
    const displays = await priceDisplays(["variant_a", "variant_a"])
    expect(displays).toEqual({
      variant_a: {
        current: "66.67",
        regular: "66.67",
        before: null,
        on_sale: false,
        since: null,
        basis: null,
        rule_version: "wholesale",
        cart_offer: null,
        vat_exclusive: true,
        gross: "80.00",
      },
    })
    expect(paths()).toEqual(["/store/customers/me/wholesale", WHOLESALE_PRICES_PATH])
    const [, request] = (core.storeRequest.mock.calls as Call[])[1] ?? []
    expect(request?.headers).toEqual({ authorization: `Bearer ${jar.session}` })
    expect(request?.query).toEqual({ variant_id: ["variant_a"] })
  })

  it("keeps nothing personal in the shared cache, nor names it in the refresh contract", async () => {
    jar.session = token()
    backend(true)
    await priceDisplays(["variant_a"])
    const kept = [...storeCaches().shared.keys()]
    expect(kept.filter((key) => key.includes("/customers/me"))).toEqual([])
    for (const scope of Object.values(SCOPE_PATHS)) {
      expect(scope.some((path) => path.includes("/customers/me"))).toBe(false)
    }
  })

  it("asks a hundred variants at a time", async () => {
    jar.session = token()
    backend(true)
    const ids = Array.from({ length: 150 }, (_, i) => `variant_${String(i)}`)
    expect(Object.keys(await priceDisplays(ids))).toHaveLength(150)
    const sizes = (core.storeRequest.mock.calls as Call[])
      .filter(([path]) => path === WHOLESALE_PRICES_PATH)
      .map(([, request]) => [request.query?.["variant_id"] ?? []].flat().length)
    expect(sizes).toEqual([100, 50])
  })

  it("shows the public display when the wholesale answer fails", async () => {
    jar.session = token()
    backend("fails")
    await expect(priceDisplays(["variant_a"])).resolves.toEqual({ variant_a: PUBLIC })
  })
})
