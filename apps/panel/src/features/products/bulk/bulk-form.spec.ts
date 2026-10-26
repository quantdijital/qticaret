import { describe, expect, it } from "vitest"
import { EMPTY_BULK_FORM, bulkChangeOf, examplePrice } from "./bulk-form"
import type { BulkForm } from "./bulk-form"

const form = (fields: Partial<BulkForm>): BulkForm => ({ ...EMPTY_BULK_FORM, ...fields })

describe("bulk edit form", () => {
  it("reads prices the Turkish way, and a direction as the sign", () => {
    expect(bulkChangeOf("price", form({ value: "1.250,50" }))).toEqual({
      change: { action: "price", mode: "set", value: 1250.5 },
    })
    expect(
      bulkChangeOf("price", form({ priceMode: "percent", direction: "down", value: "15" }))
    ).toEqual({ change: { action: "price", mode: "percent", value: -15 } })
    expect(
      bulkChangeOf("price", form({ priceMode: "amount", direction: "up", value: "2,5" }))
    ).toEqual({ change: { action: "price", mode: "amount", value: 2.5 } })
  })

  it("names what the server would refuse on the form", () => {
    expect(bulkChangeOf("price", form({ value: "0" }))).toEqual({
      error: "products.bulk.errors.price",
    })
    expect(
      bulkChangeOf("price", form({ priceMode: "percent", direction: "down", value: "100" }))
    ).toEqual({ error: "products.bulk.errors.fall" })
    expect(
      bulkChangeOf("price", form({ priceMode: "percent", direction: "up", value: "abc" }))
    ).toEqual({ error: "products.bulk.errors.rise" })
    expect(bulkChangeOf("stock", form({ stockMode: "set", value: "2,5" }))).toEqual({
      error: "products.bulk.errors.quantity",
    })
    expect(bulkChangeOf("stock", form({ stockMode: "remove", value: "0" }))).toEqual({
      error: "products.bulk.errors.adjust",
    })
    expect(bulkChangeOf("category", form({ categoryId: "" }))).toEqual({
      error: "products.bulk.errors.category",
    })
    expect(bulkChangeOf("seo_template", form({ seoTitle: false }))).toEqual({
      error: "products.bulk.errors.seoFields",
    })
  })

  it("makes the stock, category, SEO and alt text changes", () => {
    expect(bulkChangeOf("stock", form({ stockMode: "remove", value: "1.000" }))).toEqual({
      change: { action: "stock", mode: "adjust", value: -1000 },
    })
    expect(bulkChangeOf("stock", form({ stockMode: "set", value: "0" }))).toEqual({
      change: { action: "stock", mode: "set", value: 0 },
    })
    expect(
      bulkChangeOf("category", form({ categoryMode: "primary", categoryId: "pcat_1" }))
    ).toEqual({ change: { action: "category", mode: "primary", category_id: "pcat_1" } })
    expect(bulkChangeOf("seo_template", form({ seoDescription: true }))).toEqual({
      change: { action: "seo_template", fields: ["seo_title", "seo_description"] },
    })
    expect(bulkChangeOf("alt_text", form({}))).toEqual({ change: { action: "alt_text" } })
  })

  it("shows a price change on an example as the server rounds it", () => {
    expect(examplePrice({ action: "price", mode: "percent", value: 10 }, 19.99)).toBe(21.99)
    expect(examplePrice({ action: "price", mode: "amount", value: -0.5 }, 100)).toBe(99.5)
    expect(examplePrice({ action: "alt_text" }, 100)).toBeNull()
  })
})
