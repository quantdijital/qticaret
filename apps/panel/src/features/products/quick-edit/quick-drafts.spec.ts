import { describe, expect, it } from "vitest"
import {
  changeCount,
  changedFields,
  draftProblems,
  hasProblems,
  saveOf,
  shelfOf,
  storedValues,
} from "./quick-drafts"
import type { QuickProduct } from "./quick-drafts"

const LOC = "sloc_1"

const product = (over: Partial<QuickProduct> = {}, managed = true): QuickProduct => ({
  id: "prod_1",
  title: "Çakı",
  status: "published",
  variants: [
    {
      id: "variant_1",
      manage_inventory: managed,
      prices: [
        { id: "price_try", amount: 1250.5, currency_code: "try" },
        { id: "price_eur", amount: 40, currency_code: "eur" },
      ],
      inventory_items: [
        {
          inventory_item_id: "iitem_1",
          inventory: { location_levels: [{ location_id: LOC, stocked_quantity: 7 }] },
        },
      ],
    },
  ],
  ...over,
})

describe("the product list's quick edit", () => {
  it("shows the stored price and shelf count the way the fields take them", () => {
    expect(storedValues(product(), LOC)).toEqual({
      price: "1.250,50",
      stock: "7",
      status: "published",
    })
  })

  it("edits no stock that is not tracked, nor without the shop's location", () => {
    expect(shelfOf(product({}, false), LOC)).toBeNull()
    expect(shelfOf(product(), null)).toBeNull()
    expect(storedValues(product({}, false), LOC).stock).toBe("")
  })

  it("edits neither price nor stock on a product of several variants", () => {
    const several = product()
    several.variants = [...(several.variants ?? []), { id: "variant_2" }]
    expect(storedValues(several, LOC)).toMatchObject({ price: "", stock: "" })
    expect(saveOf({ product: several, price: "99" }, LOC).variant).toBeNull()
  })

  it("counts only values that differ, the same price typed another way included", () => {
    const drafts = {
      prod_1: { product: product(), price: "1250,5", stock: "9", status: "draft" as const },
      prod_2: { product: product({ id: "prod_2" }), stock: "7" },
    }
    expect(changedFields(drafts.prod_1, LOC)).toEqual(["stock", "status"])
    expect(changeCount(drafts, LOC)).toBe(2)
  })

  it("names a price or a count that cannot be saved", () => {
    const draft = { product: product(), price: "0", stock: "1,5" }
    expect(draftProblems(draft, LOC)).toEqual({ price: true, stock: true })
    expect(hasProblems({ prod_1: draft }, LOC)).toBe(true)
    expect(hasProblems({ prod_1: { product: product(), price: "99,90" } }, LOC)).toBe(false)
  })

  it("saves the new TRY price beside the others, the shelf and the status", () => {
    expect(
      saveOf({ product: product(), price: "1.499,90", stock: "12", status: "draft" }, LOC)
    ).toEqual({
      status: "draft",
      variant: {
        variantId: "variant_1",
        prices: [
          { id: "price_try", amount: 1250.5, currency_code: "try" },
          { id: "price_eur", amount: 40, currency_code: "eur" },
        ],
        amount: 1499.9,
        stock: { inventoryItemId: "iitem_1", quantity: 12, hasLevel: true },
        backorder: null,
      },
    })
  })

  it("sends only the status when only the status changed", () => {
    expect(saveOf({ product: product(), status: "draft", price: "1.250,50" }, LOC)).toEqual({
      status: "draft",
      variant: null,
    })
  })
})
