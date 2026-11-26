import { planFlatConversion } from "../flat-to-calculated"
import type { FlatOptionRow } from "../flat-to-calculated"

const flat = (over: Partial<FlatOptionRow> = {}): FlatOptionRow => ({
  id: "so_1",
  price_type: "flat",
  provider_id: "manual_manual",
  data: {},
  prices: [
    { amount: 90, currency_code: "try", price_rules: [] },
    // The free price from a basket total (F4.5): goes with the move
    {
      amount: 0,
      currency_code: "try",
      price_rules: [{ attribute: "item_total", operator: "gte" }],
    },
  ],
  rules: [{ attribute: "is_return", value: "false" }],
  service_zone: { fulfillment_set: { type: "shipping" } },
  ...over,
})

describe("flat-rate options moved to our pricing (adr/0087 §7)", () => {
  it("moves the shop's own delivery to our provider, its base price into data", () => {
    expect(planFlatConversion(flat())).toEqual({
      id: "so_1",
      price_type: "calculated",
      provider_id: "shop_shop",
      data: { id: "shop-flat", amount: 9_000 },
    })
  })

  it("keeps a contract carrier's flat option with its carrier", () => {
    expect(
      planFlatConversion(
        flat({
          provider_id: "aras_aras",
          data: { id: "aras-flat" },
          prices: [{ amount: 59.9, currency_code: "try" }],
        })
      )
    ).toEqual({
      id: "so_1",
      price_type: "calculated",
      provider_id: "aras_aras",
      data: { id: "aras-flat", amount: 5_990 },
    })
  })

  it("takes a region's price when there is no plain one (Medusa Admin's way)", () => {
    const update = planFlatConversion(
      flat({
        prices: [
          {
            amount: 120,
            currency_code: "try",
            price_rules: [{ attribute: "region_id", operator: "eq" }],
          },
        ],
      })
    )
    expect(update?.data.amount).toBe(12_000)
  })

  it("leaves alone what is not to move: calculated, pickup, returns, other providers, no price", () => {
    expect(planFlatConversion(flat({ price_type: "calculated" }))).toBeNull()
    expect(
      planFlatConversion(flat({ service_zone: { fulfillment_set: { type: "pickup" } } }))
    ).toBeNull()
    expect(
      planFlatConversion(flat({ rules: [{ attribute: "is_return", value: "true" }] }))
    ).toBeNull()
    expect(planFlatConversion(flat({ provider_id: "geliver_geliver" }))).toBeNull()
    expect(
      planFlatConversion(flat({ provider_id: "aras_aras", data: { id: "aras-table" } }))
    ).toBeNull()
    expect(planFlatConversion(flat({ prices: [] }))).toBeNull()
  })
})
