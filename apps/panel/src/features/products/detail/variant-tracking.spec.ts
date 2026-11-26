import { describe, expect, it } from "vitest"
import type { ProductDetail } from "@/features/products/api/products"
import { bulkEdit, bulkValue } from "./variant-bulk"
import { savedVariant, variantEdit } from "./variant-values"
import type { Variant } from "./variant-values"

const PRODUCT = { id: "prod_1", images: [], media_assets: [] } as unknown as ProductDetail

const variant = (id: string, tracked: boolean, stocked: number | null) =>
  ({
    id,
    manage_inventory: tracked,
    allow_backorder: false,
    prices: [{ id: `price_${id}`, amount: 249, currency_code: "try" }],
    inventory_items:
      stocked === null
        ? []
        : [
            {
              inventory_item_id: `iitem_${id}`,
              inventory: {
                location_levels: [
                  { location_id: "sloc_1", stocked_quantity: stocked, reserved_quantity: 0 },
                ],
              },
            },
          ],
  }) as unknown as Variant

const read = (each: Variant) => savedVariant(PRODUCT, each, "sloc_1", undefined, false)

describe("a variant's stock tracking", () => {
  it("reads it as stored, the kept count of an untracked variant with it", () => {
    expect(read(variant("a", false, null))).toMatchObject({ tracked: false, stock: "0" })
    expect(read(variant("b", false, 5))).toMatchObject({ tracked: false, stock: "5" })
    expect(read(variant("c", true, 3))).toMatchObject({ tracked: true, stock: "3" })
  })

  it("turns it on with the typed count; the count goes with it, not as a level write", () => {
    const untracked = variant("a", false, null)
    const edit = variantEdit(
      untracked,
      { ...read(untracked), tracked: true, stock: "7" },
      { tracked: true, stock: true },
      "sloc_1"
    )
    expect(edit).toMatchObject({ tracking: { tracked: true, quantity: 7 }, stock: null })
  })

  it("turns it off alone, a typed count left unwritten", () => {
    const tracked = variant("a", true, 3)
    const edit = variantEdit(
      tracked,
      { ...read(tracked), tracked: false, stock: "9" },
      { tracked: true, stock: true },
      "sloc_1"
    )
    expect(edit).toMatchObject({ tracking: { tracked: false }, stock: null })
  })

  it("sends nothing about it when it ends where it started", () => {
    const tracked = variant("a", true, 3)
    expect(variantEdit(tracked, read(tracked), { tracked: true }, "sloc_1")).toBeNull()
  })

  it("is turned on or off for many variants at once, the ones already so left out", () => {
    expect(bulkValue("tracking", "1")).toBe(1)
    expect(bulkValue("tracking", "0")).toBe(0)
    expect(bulkValue("tracking", "")).toBeNull()
    expect(bulkEdit(variant("a", false, null), "tracking", 1, "sloc_1")).toMatchObject({
      variantId: "a",
      tracking: { tracked: true },
    })
    expect(bulkEdit(variant("b", true, 2), "tracking", 1, "sloc_1")).toBeNull()
    expect(bulkEdit(variant("b", true, 2), "tracking", 0, "sloc_1")).toMatchObject({
      tracking: { tracked: false },
    })
  })
})
