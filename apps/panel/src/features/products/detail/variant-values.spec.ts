import { describe, expect, it } from "vitest"
import { savedRows, variantEdits } from "./variant-values"
import type { Variant } from "./variant-values"

const variant = (id: string, levels: { location_id: string; stocked_quantity: number }[]) =>
  ({
    id,
    manage_inventory: true,
    allow_backorder: false,
    prices: [{ id: `price_${id}`, amount: 249, currency_code: "try" }],
    inventory_items: [
      {
        inventory_item_id: `iitem_${id}`,
        inventory: { location_levels: levels.map((level) => ({ ...level, reserved_quantity: 0 })) },
      },
    ],
  }) as unknown as Variant

describe("variant edits", () => {
  const variants = [
    variant("a", [{ location_id: "sloc_1", stocked_quantity: 4 }]),
    variant("b", []),
  ]
  const values = savedRows(variants, "sloc_1")

  it("reads the stored rows: price, stock at the default location, preorder off", () => {
    expect(values.rows).toEqual([
      { price: "249,00", stock: "4", backorder: false, cost: "" },
      { price: "249,00", stock: "0", backorder: false, cost: "" },
    ])
  })

  it("sends only what was changed, a new level where there is none", () => {
    const changed = {
      rows: [
        { price: "249,00", stock: "4", backorder: true, cost: "" },
        { price: "299,90", stock: "7", backorder: false, cost: "" },
      ],
    }
    const edits = variantEdits(
      variants,
      changed,
      [{ backorder: true }, { price: true, stock: true }],
      "sloc_1"
    )
    expect(edits).toEqual([
      expect.objectContaining({ variantId: "a", amount: null, stock: null, backorder: true }),
      expect.objectContaining({
        variantId: "b",
        amount: 299.9,
        stock: { inventoryItemId: "iitem_b", quantity: 7, hasLevel: false },
        backorder: null,
      }),
    ])
    expect(variantEdits(variants, values, undefined, "sloc_1")).toEqual([])
  })

  it("sends a unit cost only when it changed, an emptied one as cleared", () => {
    const costed = savedRows(variants, "sloc_1", new Map([["a", 120.5]]))
    const changed = {
      rows: [
        { ...values.rows[0], price: "249,00", stock: "4", backorder: false, cost: "" },
        { ...values.rows[1], price: "249,00", stock: "0", backorder: false, cost: "88,90" },
      ],
    }
    const edits = variantEdits(variants, changed, [{ cost: true }, { cost: true }], "sloc_1")

    expect(costed.rows[0]?.cost).toBe("120,50")
    expect(edits).toEqual([
      expect.objectContaining({ variantId: "a", cost: null, amount: null }),
      expect.objectContaining({ variantId: "b", cost: 88.9, amount: null }),
    ])
    expect(variantEdits(variants, values, [{ price: true }], "sloc_1")[0]).not.toHaveProperty(
      "cost"
    )
  })

  it("writes no stock without a default location", () => {
    const [edit] = variantEdits(variants, values, [{ stock: true, price: true }], null)
    expect(edit).toMatchObject({ stock: null, amount: 249 })
  })
})
