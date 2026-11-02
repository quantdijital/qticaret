import { isMarkedDown, saleProducts } from "../sale"

describe("what is on sale now (adr/0019 ek 2026-11-03, /kampanyalar)", () => {
  it.each([
    ["a sale price list's price", { calculated_amount: 80, original_amount: 100 }, true],
    [
      "amounts as Medusa's big numbers send them",
      { calculated_amount: "79.9", original_amount: "100" },
      true,
    ],
    ["the regular price", { calculated_amount: 100, original_amount: 100 }, false],
    // An override list sets the original to its own price
    ["an override price list's price", { calculated_amount: 80, original_amount: 80 }, false],
    ["a price above the original", { calculated_amount: 120, original_amount: 100 }, false],
    // A sale list with no default price beside it: nothing to compare with
    ["a sale price with no original", { calculated_amount: 80, original_amount: null }, false],
    ["no price in the currency", { calculated_amount: null, original_amount: null }, false],
    ["an amount that is no number", { calculated_amount: "x", original_amount: 100 }, false],
  ])("counts %s as marked down: %s", (_label, price, expected) => {
    expect(isMarkedDown(price)).toBe(expected)
  })

  it("counts no price at all as no sale", () => {
    expect(isMarkedDown(null)).toBe(false)
    expect(isMarkedDown(undefined)).toBe(false)
  })

  it("lists each product once when the 30-day rule shows a variant of it as a discount", () => {
    const variants = [
      { id: "variant_1", product_id: "prod_a" },
      { id: "variant_2", product_id: "prod_a" },
      { id: "variant_3", product_id: "prod_b" },
      { id: "variant_4", product_id: "prod_c" },
    ]
    const displays = new Map([
      ["variant_1", { on_sale: true }],
      ["variant_2", { on_sale: true }],
      // Cut back to a price of the last 30 days: not shown as a discount, not listed
      ["variant_3", { on_sale: false }],
    ])
    expect(saleProducts(variants, displays)).toEqual(["prod_a"])
  })
})
