import { describe, expect, it } from "vitest"
import { availableStock, listSku, priceRange } from "./product-math"

const variant = (amount: number, available: number, managed = true) => ({
  manage_inventory: managed,
  prices: [
    { amount, currency_code: "try" },
    { amount: amount / 30, currency_code: "eur" },
  ],
  inventory_items: [{ inventory: { location_levels: [{ available_quantity: available }] } }],
})

describe("priceRange", () => {
  it("spans the variants' prices in the shop's currency", () => {
    expect(priceRange([variant(249, 3), variant(399, 0)], "try")).toEqual({ min: 249, max: 399 })
  })

  it("is null without a price in that currency", () => {
    expect(priceRange([], "try")).toBeNull()
    expect(priceRange([{ prices: [{ amount: 10, currency_code: "eur" }] }], "try")).toBeNull()
  })
})

describe("availableStock", () => {
  it("sums what can be sold across tracked variants and locations", () => {
    expect(availableStock([variant(1, 3), variant(1, 4), variant(1, 99, false)])).toBe(7)
  })

  it("is null when no variant tracks stock", () => {
    expect(availableStock([variant(1, 3, false)])).toBeNull()
  })
})

describe("listSku", () => {
  it("shows the first variant's code and how many others have one", () => {
    expect(listSku([{ sku: " BC-1 " }, { sku: "" }, { sku: "BC-3" }])).toEqual({
      sku: "BC-1",
      more: 1,
    })
  })

  it("is null when no variant has a code", () => {
    expect(listSku([{ sku: null }, null])).toBeNull()
    expect(listSku(undefined)).toBeNull()
  })
})
