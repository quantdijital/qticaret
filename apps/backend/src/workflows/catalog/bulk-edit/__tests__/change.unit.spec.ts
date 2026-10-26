import { BulkEditInput, MAX_BULK_PRODUCTS } from "../change"

const ids = (count: number) => Array.from({ length: count }, (_, index) => `prod_${String(index)}`)
const accepts = (change: unknown, productIds = ["prod_1"]) =>
  BulkEditInput.safeParse({ product_ids: productIds, change }).success

describe("bulk edit input", () => {
  it("takes each kind of change", () => {
    expect(accepts({ action: "price", mode: "set", value: 149.9 })).toBe(true)
    expect(accepts({ action: "price", mode: "percent", value: -15 })).toBe(true)
    expect(accepts({ action: "price", mode: "amount", value: -20 })).toBe(true)
    expect(accepts({ action: "stock", mode: "set", value: 0 })).toBe(true)
    expect(accepts({ action: "stock", mode: "adjust", value: -3 })).toBe(true)
    expect(accepts({ action: "status", status: "draft" })).toBe(true)
    expect(accepts({ action: "category", mode: "primary", category_id: "pcat_1" })).toBe(true)
    expect(accepts({ action: "seo_template", fields: ["seo_title"] })).toBe(true)
    expect(accepts({ action: "alt_text" })).toBe(true)
  })

  it("refuses changes that would do nothing or harm", () => {
    expect(accepts({ action: "price", mode: "set", value: 0 })).toBe(false)
    expect(accepts({ action: "price", mode: "percent", value: 0 })).toBe(false)
    expect(accepts({ action: "price", mode: "percent", value: -100 })).toBe(false)
    expect(accepts({ action: "price", mode: "amount", value: Number.POSITIVE_INFINITY })).toBe(
      false
    )
    expect(accepts({ action: "stock", mode: "set", value: -1 })).toBe(false)
    expect(accepts({ action: "stock", mode: "set", value: 1.5 })).toBe(false)
    expect(accepts({ action: "stock", mode: "adjust", value: 0 })).toBe(false)
    expect(accepts({ action: "status", status: "proposed" })).toBe(false)
    expect(accepts({ action: "seo_template", fields: [] })).toBe(false)
    expect(accepts({ action: "seo_template", fields: ["focus_keyword"] })).toBe(false)
    expect(accepts({ action: "alt_text", overwrite: true })).toBe(false)
    expect(accepts({ action: "delete" })).toBe(false)
  })

  it("names each product once, and at most a thousand", () => {
    const change = { action: "status", status: "draft" }
    expect(accepts(change, ids(MAX_BULK_PRODUCTS))).toBe(true)
    expect(accepts(change, ids(MAX_BULK_PRODUCTS + 1))).toBe(false)
    expect(accepts(change, [])).toBe(false)
    expect(accepts(change, ["prod_1", "prod_1"])).toBe(false)
  })
})
