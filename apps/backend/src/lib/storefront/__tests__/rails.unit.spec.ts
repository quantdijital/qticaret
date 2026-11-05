import { cutOf, deepestFirst, topUp } from "../rails"

const shown = (current: number, before: number | null, on_sale = before !== null) => ({
  on_sale,
  current,
  before,
})

describe("home rails picked on the server (adr/0049 Ek 2026-11-05)", () => {
  describe("cutOf", () => {
    it("is the share the struck-through price takes off", () => {
      expect(cutOf(shown(80_00, 100_00))).toBeCloseTo(0.2)
      expect(cutOf(shown(50_00, 200_00))).toBeCloseTo(0.75)
    })

    it("is nothing without a discount shown", () => {
      expect(cutOf(undefined)).toBe(0)
      expect(cutOf(shown(100_00, null))).toBe(0)
      // A price before that is not above the current one is no discount (the price-before rule)
      expect(cutOf(shown(100_00, 100_00))).toBe(0)
      expect(cutOf({ on_sale: false, current: 80_00, before: 100_00 })).toBe(0)
    })
  })

  describe("deepestFirst", () => {
    const variants = [
      { id: "var_a1", product_id: "prod_a" },
      { id: "var_a2", product_id: "prod_a" },
      { id: "var_b", product_id: "prod_b" },
      { id: "var_c", product_id: "prod_c" },
      { id: "var_d", product_id: "prod_d" },
    ]

    it("puts the deepest cut of any variant first, equal cuts in the order given", () => {
      const displays = new Map([
        ["var_a1", shown(90_00, 100_00)],
        // The product's deepest variant counts
        ["var_a2", shown(60_00, 100_00)],
        ["var_b", shown(70_00, 100_00)],
        ["var_c", shown(80_00, 100_00)],
        ["var_d", shown(140_00, 200_00)],
      ])
      // The index's order: the newest first
      expect(deepestFirst(["prod_d", "prod_c", "prod_b", "prod_a"], variants, displays)).toEqual([
        "prod_a",
        "prod_d",
        "prod_b",
        "prod_c",
      ])
    })

    it("keeps a product the prices no longer show on sale, last, as the sale page lists it", () => {
      const displays = new Map([
        ["var_a1", shown(100_00, null)],
        ["var_b", shown(90_00, 100_00)],
        ["var_c", shown(90_00, 100_00)],
      ])
      expect(deepestFirst(["prod_a", "prod_b", "prod_c"], variants, displays)).toEqual([
        "prod_b",
        "prod_c",
        "prod_a",
      ])
    })
  })

  describe("topUp", () => {
    it("takes the best sellers alone when they fill the rail", () => {
      expect(topUp(["prod_a", "prod_b", "prod_c"], ["prod_x"], 2)).toEqual({
        product_ids: ["prod_a", "prod_b"],
        filled_with_newest: false,
      })
    })

    it("makes up a rail short of sales with the newest products, and says so", () => {
      expect(topUp(["prod_b"], ["prod_c", "prod_b", "prod_a", "prod_z"], 3)).toEqual({
        product_ids: ["prod_b", "prod_c", "prod_a"],
        filled_with_newest: true,
      })
    })

    it("is the newest alone with no sales, and nothing with no products", () => {
      expect(topUp([], ["prod_c", "prod_b"], 4)).toEqual({
        product_ids: ["prod_c", "prod_b"],
        filled_with_newest: true,
      })
      expect(topUp([], [], 4)).toEqual({ product_ids: [], filled_with_newest: false })
    })
  })
})
