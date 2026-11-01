import { isFreeShippingPrice, planFreeShipping } from "../free-shipping"
import type { ShippingOptionRow } from "../free-shipping"

const base = { id: "price_base", amount: 90, currency_code: "try", price_rules: [] }
const free = (value: number) => ({
  id: "price_free",
  amount: 0,
  currency_code: "try",
  price_rules: [{ attribute: "item_total", operator: "gte", value: String(value) }],
})
// The shop's own conditional price, set in Medusa Admin: not the platform's
const shops = {
  id: "price_shop",
  amount: 50,
  currency_code: "try",
  price_rules: [{ attribute: "item_total", operator: "gte", value: "300" }],
}
const option = (
  prices: NonNullable<ShippingOptionRow["prices"]>,
  priceType = "flat"
): ShippingOptionRow => ({
  id: "so_1",
  price_type: priceType,
  prices,
})
const rule = (value: number) => [{ attribute: "item_total", operator: "gte", value }]

describe("free shipping from a basket total (F4.5)", () => {
  it("adds a 0 price from the threshold beside each currency's own price", () => {
    expect(planFreeShipping(option([base, shops]), 500)).toEqual([
      { id: "price_base" },
      { id: "price_shop" },
      { currency_code: "try", amount: 0, rules: rule(500) },
    ])
  })

  it("moves its own price to a new threshold, and takes it away with none", () => {
    expect(planFreeShipping(option([base, free(500)]), 750)).toEqual([
      { id: "price_base" },
      { id: "price_free", currency_code: "try", amount: 0, rules: rule(750) },
    ])
    expect(planFreeShipping(option([base, free(500)]), null)).toEqual([{ id: "price_base" }])
  })

  it("changes nothing already right, nothing without a threshold, nothing a carrier prices", () => {
    expect(planFreeShipping(option([base, free(500)]), 500)).toBeNull()
    expect(planFreeShipping(option([base, shops]), null)).toBeNull()
    expect(planFreeShipping(option([base], "calculated"), 500)).toBeNull()
  })

  it("knows its own price: 0 from a basket total, and nothing else", () => {
    expect(isFreeShippingPrice(free(500))).toBe(true)
    expect(isFreeShippingPrice(shops)).toBe(false)
    expect(isFreeShippingPrice({ ...free(500), price_rules: [] })).toBe(false)
  })

  it("gives a region's price (Medusa Admin prices options per region) the currency's free price", () => {
    const region = {
      id: "price_region",
      amount: 90,
      currency_code: "try",
      price_rules: [{ attribute: "region_id", operator: "eq", value: "reg_1" }],
    }
    expect(planFreeShipping(option([region]), 1500)).toEqual([
      { id: "price_region" },
      { currency_code: "try", amount: 0, rules: rule(1500) },
    ])
    expect(planFreeShipping(option([region, free(1500)]), 1500)).toBeNull()
    // A plain price and a region's in one currency: one free price
    expect(planFreeShipping(option([base, region]), 500)).toHaveLength(3)
  })
})
