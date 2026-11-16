import { kurus } from "../../money"
import { isShortOfMinimum, orderUnits, promotionShells, stalePriceLines } from "../cart"

const line = (id: string, fields: Record<string, unknown> = {}) => ({
  id,
  variant_id: `variant_${id}`,
  quantity: 1,
  unit_price: 80,
  is_custom_price: false,
  ...fields,
})

describe("a wholesale order's units (ADR-0068 §8)", () => {
  it("counts the product lines' quantities, not the fee of paying at the door", () => {
    expect(
      orderUnits([
        line("a", { quantity: 4 }),
        line("b", { quantity: "6" }),
        line("fee", { variant_id: null, is_custom_price: true }),
        null,
      ])
    ).toBe(10)
    expect(orderUnits(null)).toBe(0)
  })

  it("is short only below a minimum that is set", () => {
    expect(isShortOfMinimum(10, 9)).toBe(true)
    expect(isShortOfMinimum(10, 10)).toBe(false)
    expect(isShortOfMinimum(null, 0)).toBe(false)
    expect(isShortOfMinimum(0, 0)).toBe(false)
  })
})

describe("lines not at the customer's price now (ADR-0068 §7)", () => {
  it("names the lines whose price moved, to the kuruş", () => {
    const now = new Map([
      ["a", kurus(8000)],
      ["b", kurus(10_000)],
      ["c", kurus(6667)],
    ])
    expect(
      stalePriceLines([line("a"), line("b"), line("c", { unit_price: "66.67" }), line("d")], now)
    ).toEqual(["b"])
  })

  it("leaves lines priced by their own rules and lines with no price now", () => {
    const now = new Map([
      ["addon", kurus(100)],
      ["fee", kurus(100)],
    ])
    expect(
      stalePriceLines(
        [
          line("addon", { is_custom_price: true }),
          line("fee", { variant_id: null }),
          line("unpriced"),
        ],
        now
      )
    ).toEqual([])
  })
})

describe("a wholesaler's cart as promotion rules read it (ADR-0068 §6)", () => {
  it("keeps each line's and method's id and adjustments, and nothing a promotion applies to", () => {
    const adjustment = { id: "adj_1", code: "YAZ10", item_id: "item_1", amount: 8 }
    const shipping = { id: "smadj_1", code: "KARGO", shipping_method_id: "sm_1", amount: 5 }
    const shells = promotionShells({
      items: [
        {
          id: "item_1",
          adjustments: [adjustment],
          ...{ product_id: "prod_1", subtotal: 80, is_discountable: true, quantity: 2 },
        },
        { id: "item_2" },
        null,
      ],
      shipping_methods: [{ id: "sm_1", adjustments: [shipping], ...{ subtotal: 50 } }],
    })
    expect(shells).toEqual({
      items: [
        {
          id: "item_1",
          quantity: 0,
          subtotal: 0,
          original_total: 0,
          is_discountable: false,
          adjustments: [adjustment],
        },
        {
          id: "item_2",
          quantity: 0,
          subtotal: 0,
          original_total: 0,
          is_discountable: false,
          adjustments: [],
        },
      ],
      shipping_methods: [{ id: "sm_1", subtotal: 0, original_total: 0, adjustments: [shipping] }],
    })
  })

  it("gives an empty cart empty lists, never leaving Medusa's own in place", () => {
    expect(promotionShells({})).toEqual({ items: [], shipping_methods: [] })
  })
})
