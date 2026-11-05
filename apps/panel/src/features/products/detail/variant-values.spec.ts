import { describe, expect, it } from "vitest"
import { firstUncoded, gtinField } from "./variant-codes"
import { savedRows, variantEdits, variantsSchemaFor } from "./variant-values"
import type { Variant, VariantValues } from "./variant-values"

const variant = (
  id: string,
  levels: { location_id: string; stocked_quantity: number }[],
  codes: { sku?: string; ean?: string; upc?: string; barcode?: string } = {}
) =>
  ({
    id,
    manage_inventory: true,
    allow_backorder: false,
    sku: null,
    ean: null,
    upc: null,
    barcode: null,
    ...codes,
    prices: [{ id: `price_${id}`, amount: 249, currency_code: "try" }],
    inventory_items: [
      {
        inventory_item_id: `iitem_${id}`,
        inventory: { location_levels: levels.map((level) => ({ ...level, reserved_quantity: 0 })) },
      },
    ],
  }) as unknown as Variant

const catalogRow = (id: string, extra: { cost?: number; mpn?: string } = {}) => ({
  id,
  title: null,
  sku: null,
  gtin: null,
  cost: extra.cost ?? null,
  mpn: extra.mpn ?? null,
})

const blank = { sku: "", gtin: "", mpn: "" }

describe("variant edits", () => {
  const variants = [
    variant("a", [{ location_id: "sloc_1", stocked_quantity: 4 }]),
    variant("b", []),
  ]
  const values = savedRows(variants, "sloc_1")

  it("reads the stored rows: price, stock at the default location, preorder off", () => {
    expect(values.rows).toEqual([
      { price: "249,00", stock: "4", backorder: false, cost: "", ...blank },
      { price: "249,00", stock: "0", backorder: false, cost: "", ...blank },
    ])
  })

  it("sends only what was changed, a new level where there is none", () => {
    const changed = {
      rows: [
        { price: "249,00", stock: "4", backorder: true, cost: "", ...blank },
        { price: "299,90", stock: "7", backorder: false, cost: "", ...blank },
      ],
    }
    const edits = variantEdits(
      variants,
      changed,
      [{ backorder: true }, { price: true, stock: true }],
      "sloc_1"
    )
    expect(edits).toEqual([
      expect.objectContaining({
        variantId: "a",
        amount: null,
        stock: null,
        backorder: true,
        codes: null,
      }),
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
    const costed = savedRows(variants, "sloc_1", new Map([["a", catalogRow("a", { cost: 120.5 })]]))
    const changed = {
      rows: [
        { price: "249,00", stock: "4", backorder: false, cost: "", ...blank },
        { price: "249,00", stock: "0", backorder: false, cost: "88,90", ...blank },
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

describe("variant codes", () => {
  it("reads the barcode from the field structured data uses, else from the EAN", () => {
    const upc = variant("a", [], { upc: "036000291452", barcode: "RAF-25" })
    const inHouse = variant("b", [], { barcode: "RAF-25" })
    const typo = variant("c", [], { ean: "4006381333932" })

    expect(gtinField(upc)).toBe("upc")
    expect(gtinField(inHouse)).toBe("ean")
    expect(gtinField(typo)).toBe("ean")
    const rows = savedRows(
      [upc, inHouse, typo],
      null,
      new Map([["b", catalogRow("b", { mpn: "RAF-25-ST" })]])
    ).rows
    expect(rows.map(({ sku, gtin, mpn }) => ({ sku, gtin, mpn }))).toEqual([
      { sku: "", gtin: "036000291452", mpn: "" },
      { sku: "", gtin: "", mpn: "RAF-25-ST" },
      { sku: "", gtin: "4006381333932", mpn: "" },
    ])
  })

  it("sends the changed codes where they are kept: SKU and barcode to the variant, MPN to the catalog", () => {
    const variants = [
      variant("a", [], { upc: "036000291452", sku: "MYL-1" }),
      variant("b", [], { barcode: "RAF-25" }),
    ]
    const changed = {
      rows: [
        { price: "249,00", stock: "0", backorder: false, cost: "", sku: "", gtin: "", mpn: "" },
        {
          price: "249,00",
          stock: "0",
          backorder: false,
          cost: "",
          sku: " MYL-2 ",
          gtin: "8 690000 000005",
          mpn: " RAF-25-ST ",
        },
      ],
    }
    const edits = variantEdits(
      variants,
      changed,
      [
        { sku: true, gtin: true },
        { sku: true, gtin: true, mpn: true },
      ],
      null
    )

    expect(edits).toEqual([
      expect.objectContaining({ variantId: "a", codes: { sku: null, upc: null }, amount: null }),
      expect.objectContaining({
        variantId: "b",
        // The in-house code in `barcode` stays; the GTIN goes to the EAN
        codes: { sku: "MYL-2", ean: "8690000000005" },
        mpn: "RAF-25-ST",
      }),
    ])
    expect(edits[0]).not.toHaveProperty("mpn")
  })

  const check = (saved: VariantValues, gtin: string) => {
    const typed = { rows: [{ ...saved.rows[0], gtin }] }
    const result = variantsSchemaFor(saved).safeParse(typed)
    return result.success ? null : result.error.issues.map((issue) => issue.message)
  }

  it("refuses a typed barcode whose check digit does not fit, never an empty one", () => {
    const saved = savedRows([variant("a", [])], null)

    expect(check(saved, "")).toBeNull()
    expect(check(saved, "8690000000005")).toBeNull()
    expect(check(saved, "8690000000001")).toEqual(["products.errors.gtin.check"])
    expect(check(saved, "86900")).toEqual(["products.errors.gtin.format"])
  })

  it("lets a stored code that is not a GTIN through, so a price can still be saved", () => {
    const saved = savedRows([variant("a", [], { ean: "4006381333932" })], null)

    expect(check(saved, "4006381333932")).toBeNull()
    expect(check(saved, "4006381333933")).toEqual(["products.errors.gtin.check"])
  })

  it("sends the advisor's jump to the first variant without a barcode or an MPN", () => {
    const row = (gtin: string, mpn = "") => ({ sku: "", gtin, mpn })

    expect(firstUncoded([row("8690000000005"), row("", "RAF"), row("")])).toBe(2)
    expect(firstUncoded([row("8690000000005"), row("", "RAF")])).toBe(1)
    expect(firstUncoded([row("8690000000005")])).toBe(0)
  })
})
