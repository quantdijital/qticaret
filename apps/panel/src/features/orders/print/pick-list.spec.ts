import { describe, expect, it } from "vitest"
import { pickList } from "./pick-list"
import { item, order } from "./print.fixtures"

const ENGRAVING = { label: "Ürün üzerine yazı", value: "Ahmet", kind: "text" as const }

describe("pickList", () => {
  it("sums a product's units across the orders, each order's line and add-ons under it", () => {
    const rows = pickList([
      order({
        id: "order_1",
        display_id: 1042,
        items: [
          item({ quantity: 2, addons: [ENGRAVING] }),
          item({ id: "l2", sku: "TAS-1", title: "Bileme taşı", variant: null }),
        ],
      }),
      order({ id: "order_2", display_id: 1043, items: [item({ quantity: 1 })] }),
    ])

    expect(rows.map((row) => [row.title, row.quantity])).toEqual([
      ["Bileme taşı", 1],
      ["Şef Bıçağı", 3],
    ])
    expect(rows[1]?.entries).toEqual([
      { orderId: "order_1", displayId: 1042, quantity: 2, addons: [ENGRAVING] },
      { orderId: "order_2", displayId: 1043, quantity: 1, addons: [] },
    ])
  })

  it("groups a product without a SKU by name and variant, and leaves out what goes in no box", () => {
    const rows = pickList([
      order({
        items: [
          item({ sku: null, variant: "Siyah" }),
          item({ id: "l2", sku: null, variant: "Kahverengi" }),
          item({ id: "l3", sku: null, variant: "Siyah", quantity: 4 }),
          item({ id: "l4", title: "Hediye kartı", sku: null, variant: null, ships: false }),
        ],
      }),
    ])

    expect(rows.map((row) => [row.variant, row.quantity])).toEqual([
      ["Kahverengi", 1],
      ["Siyah", 5],
    ])
  })
})
