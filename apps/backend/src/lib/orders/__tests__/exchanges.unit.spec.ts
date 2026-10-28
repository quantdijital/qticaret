import { exchangeDifference, exchangeProblem } from "../exchanges"
import type { ExchangeOrderLine, ExchangeVariant } from "../exchanges"

const lines = new Map<string, ExchangeOrderLine>([
  [
    "ordli_m",
    { id: "ordli_m", product_id: "prod_shirt", variant_id: "variant_m", unit_price: 50_000 },
  ],
])
const variants = new Map<string, ExchangeVariant>([
  ["variant_m", { id: "variant_m", product_id: "prod_shirt", price: 50_000, available: 3 }],
  ["variant_l", { id: "variant_l", product_id: "prod_shirt", price: 50_000, available: 1 }],
  ["variant_xl", { id: "variant_xl", product_id: "prod_shirt", price: 55_000, available: 5 }],
  ["variant_s", { id: "variant_s", product_id: "prod_shirt", price: 45_000, available: 5 }],
  ["variant_mug", { id: "variant_mug", product_id: "prod_mug", price: 20_000, available: 5 }],
  ["variant_gone", { id: "variant_gone", product_id: "prod_shirt", price: null, available: 5 }],
])
const swap = (variant_id: string, quantity = 1) => [
  { line_item_id: "ordli_m", variant_id, quantity },
]

describe("exchanges (adr/0032 §6)", () => {
  it("takes another variant of the same product, in stock and for sale", () => {
    expect(exchangeProblem(lines, variants, swap("variant_l"))).toBeNull()
    expect(exchangeProblem(lines, variants, swap("variant_m"))).toBe(
      "returns.exchange_same_variant"
    )
    expect(exchangeProblem(lines, variants, swap("variant_mug"))).toBe(
      "returns.exchange_variant_invalid"
    )
    expect(exchangeProblem(lines, variants, swap("variant_gone"))).toBe(
      "returns.exchange_variant_invalid"
    )
    expect(exchangeProblem(lines, variants, swap("variant_unknown"))).toBe(
      "returns.exchange_variant_invalid"
    )
    expect(exchangeProblem(lines, variants, swap("variant_l", 2))).toBe(
      "returns.exchange_out_of_stock"
    )
  })

  it("costs today's price less the price at purchase: nothing at the same price", () => {
    expect(exchangeDifference(lines, variants, swap("variant_l"))).toBe(0)
    // The shopper owes 50 TL a unit for the dearer size; the shop owes 50 TL for the cheaper
    expect(exchangeDifference(lines, variants, swap("variant_xl", 2))).toBe(10_000)
    expect(exchangeDifference(lines, variants, swap("variant_s"))).toBe(-5_000)
  })
})
