import { kurus } from "../../money"
import { shownByProduct } from "../sale"

const shown = (on_sale: boolean, lira: number) => ({ on_sale, current: kurus(lira * 100) })

describe("what is on sale now and its shown price (adr/0019 ek 2026-11-03, /kampanyalar)", () => {
  const variants = [
    { id: "variant_1", product_id: "prod_a" },
    { id: "variant_2", product_id: "prod_a" },
    { id: "variant_3", product_id: "prod_b" },
    { id: "variant_4", product_id: "prod_c" },
    { id: "variant_5", product_id: "prod_d" },
  ]

  it("marks a product on sale when the price-before rule shows a variant of it as a discount", () => {
    const products = shownByProduct(
      variants,
      new Map([
        ["variant_1", shown(false, 120)],
        ["variant_2", shown(true, 80)],
        // Cut back to a price of the last 10 days: not shown as a discount, not listed
        ["variant_3", shown(false, 90)],
      ])
    )
    expect(Object.fromEntries(products)).toEqual({
      prod_a: { on_sale: true, lowest: 8000 },
      prod_b: { on_sale: false, lowest: 9000 },
    })
  })

  it("counts an automatic promotion as its display does, and keeps the lowest shown price", () => {
    // adr/0023 Ek 2026-11-05: the display's `current` and `on_sale` count the promotion every
    // shopper gets; a promotion on a price raised since it began shows no discount
    const products = shownByProduct(
      variants,
      new Map([
        ["variant_4", shown(true, 1224.3)],
        ["variant_5", shown(false, 1400)],
      ])
    )
    expect(products.get("prod_c")).toEqual({ on_sale: true, lowest: 122430 })
    expect(products.get("prod_d")).toEqual({ on_sale: false, lowest: 140000 })
  })

  it("leaves out a product without a display (no price in the currency)", () => {
    expect(shownByProduct(variants, new Map()).size).toBe(0)
  })
})
