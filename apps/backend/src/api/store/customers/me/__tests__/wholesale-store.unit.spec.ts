import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { wholesalePrices, wholesaleShopper } from "../../../../../workflows/wholesale/shopper"
import { GET as getPrices } from "../wholesale-prices/route"
import { kurus } from "../../../../../lib/money"
import { MAX_WHOLESALE_VARIANTS, StoreGetWholesalePrices } from "../wholesale-prices/validators"
import type { StoreGetWholesalePricesType } from "../wholesale-prices/validators"
import { GET as getWholesale } from "../wholesale/route"

jest.mock("../../../../../workflows/wholesale/shopper", () => ({
  wholesaleShopper: jest.fn(),
  wholesalePrices: jest.fn(),
}))

const shopper = wholesaleShopper as jest.MockedFunction<typeof wholesaleShopper>
const prices = wholesalePrices as jest.MockedFunction<typeof wholesalePrices>

function response() {
  const headers: Record<string, string> = {}
  const res = {
    setHeader: jest.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value
    }),
    json: jest.fn(),
  }
  return { res: res as unknown as MedusaResponse, headers, json: res.json }
}

const request = (query: StoreGetWholesalePricesType = { variant_id: [] }) =>
  ({
    scope: {},
    auth_context: { actor_type: "customer", actor_id: "cus_session" },
    validatedQuery: query,
    publishable_key_context: { sales_channel_ids: ["sc_1"] },
  }) as unknown as AuthenticatedMedusaRequest<unknown, StoreGetWholesalePricesType>

beforeEach(() => {
  jest.clearAllMocks()
})

/** ADR-0068 §7: the wholesaler's own answers, from the session, kept by nobody. */
describe("GET /store/customers/me/wholesale", () => {
  it("answers the session's customer, private and never stored", async () => {
    shopper.mockResolvedValue({ active: true, vat_exclusive: true, min_quantity: 10 })
    const { res, headers, json } = response()
    await getWholesale(request(), res)
    expect(shopper).toHaveBeenCalledWith({}, "cus_session")
    expect(headers["cache-control"]).toBe("private, no-store")
    expect(json).toHaveBeenCalledWith({
      wholesale: { active: true, vat_exclusive: true, min_quantity: 10 },
    })
  })
})

describe("GET /store/customers/me/wholesale-prices", () => {
  it("prices for the session's customer and the key's channels, lira and percent", async () => {
    prices.mockResolvedValue(
      new Map([["variant_a", { net: kurus(6667), gross: kurus(8000), vat_bps: 2000 }]])
    )
    const { res, headers, json } = response()
    await getPrices(request({ variant_id: ["variant_a"] }), res)
    expect(prices).toHaveBeenCalledWith(
      {},
      { customer_id: "cus_session", variant_ids: ["variant_a"], sales_channel_ids: ["sc_1"] }
    )
    expect(headers["cache-control"]).toBe("private, no-store")
    expect(json).toHaveBeenCalledWith({
      wholesale_prices: { variant_a: { net: "66.67", gross: "80.00", vat_rate: 20 } },
    })
  })

  it("answers a non-wholesaler with nothing at all", async () => {
    prices.mockResolvedValue(new Map())
    const { res, json } = response()
    await getPrices(request({ variant_id: ["variant_a"] }), res)
    expect(json).toHaveBeenCalledWith({ wholesale_prices: {} })
  })
})

describe("the wholesale prices query", () => {
  const parse = (query: unknown) => StoreGetWholesalePrices.safeParse(query)

  it("takes one variant or a page of them", () => {
    expect(parse({ variant_id: "variant_01ABC" }).data).toEqual({ variant_id: ["variant_01ABC"] })
    const page = Array.from({ length: MAX_WHOLESALE_VARIANTS }, (_, i) => `variant_${String(i)}`)
    expect(parse({ variant_id: page }).success).toBe(true)
  })

  it("refuses more than a page, none, or what is not a variant id", () => {
    const many = Array.from(
      { length: MAX_WHOLESALE_VARIANTS + 1 },
      (_, i) => `variant_${String(i)}`
    )
    expect(parse({ variant_id: many }).success).toBe(false)
    expect(parse({ variant_id: [] }).success).toBe(false)
    expect(parse({}).success).toBe(false)
    expect(parse({ variant_id: "prod_1" }).success).toBe(false)
    expect(parse({ variant_id: "variant_1' OR 1=1" }).success).toBe(false)
  })

  it("takes no customer, group or currency from the request", () => {
    for (const extra of ["customer_id", "group_id", "customer_group_id", "currency_code"]) {
      expect(parse({ variant_id: "variant_1", [extra]: "x" }).success).toBe(false)
    }
  })
})
