import { firstOverLimit, purchaseLimitOf, withAdded, withChanged } from "../purchase-limit"
import type { VariantLimit } from "../purchase-limit"

const KNIFE: VariantLimit = { product_id: "prod_knife", title: "Bıçak", limit: 2 }
const FREE: VariantLimit = { product_id: "prod_free", title: "Önlük", limit: null }

const variants = new Map<string, VariantLimit>([
  ["var_knife_s", KNIFE],
  ["var_knife_l", KNIFE],
  ["var_free", FREE],
])

describe("a product's most per order (S5)", () => {
  it("reads a stored limit as a whole number from 1 to 9999, else none", () => {
    expect(purchaseLimitOf(1)).toBe(1)
    expect(purchaseLimitOf(9999)).toBe(9999)
    for (const wrong of [0, -2, 1.5, 10_000, "3", null, undefined, Number.NaN]) {
      expect(purchaseLimitOf(wrong)).toBeNull()
    }
  })

  it("counts a product's variants together", () => {
    const lines = [
      { variant_id: "var_knife_s", quantity: 1 },
      { variant_id: "var_knife_l", quantity: 2 },
      { variant_id: "var_free", quantity: 50 },
    ]
    expect(firstOverLimit(lines, variants)).toEqual({
      product_id: "prod_knife",
      title: "Bıçak",
      limit: 2,
      quantity: 3,
    })
    expect(firstOverLimit(lines.slice(1), variants)).toBeNull()
  })

  it("leaves lines of unknown variants and products without a limit alone", () => {
    expect(
      firstOverLimit(
        [
          { variant_id: "var_gone", quantity: 99 },
          { variant_id: "var_free", quantity: 99 },
        ],
        variants
      )
    ).toBeNull()
  })

  it("adds new lines to what the cart holds", () => {
    const held = [{ id: "line_1", variant_id: "var_knife_s", quantity: 2 }]
    const next = withAdded(held, [{ variant_id: "var_knife_s", quantity: 1 }])
    expect(firstOverLimit(next, variants)?.quantity).toBe(3)
  })

  it("judges only a raised line; lowering one or an unknown line is nothing to check", () => {
    const held = [
      { id: "line_1", variant_id: "var_knife_s", quantity: 3 },
      { id: "line_2", variant_id: "var_free", quantity: 1 },
    ]
    expect(withChanged(held, "line_1", 2)).toBeNull()
    expect(withChanged(held, "line_1", 3)).toBeNull()
    expect(withChanged(held, "line_9", 5)).toBeNull()
    expect(withChanged(held, "line_2", 4)).toEqual([held[0], { ...held[1], quantity: 4 }])
  })

  it("does not count a count that is not a number", () => {
    expect(
      firstOverLimit([{ variant_id: "var_knife_s", quantity: Number.NaN }], variants)
    ).toBeNull()
  })
})
