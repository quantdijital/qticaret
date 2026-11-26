import { describe, expect, it } from "vitest"
import { EMPTY_BULK_FORM, bulkChangeOf, examplePrice } from "./bulk-form"
import type { BulkForm } from "./bulk-form"

const form = (fields: Partial<BulkForm>): BulkForm => ({ ...EMPTY_BULK_FORM, ...fields })

describe("bulk edit form: Woo's fields (P7) and the sale price", () => {
  it("asks a share or an amount off, never a total, with Turkey's days", () => {
    expect(bulkChangeOf("sale", form({ value: "12,5" }))).toEqual({
      change: { action: "sale", mode: "percent", value: 12.5, starts_at: null, ends_at: null },
    })
    expect(
      bulkChangeOf(
        "sale",
        form({ saleMode: "amount", value: "50", saleStarts: "2099-12-01", saleEnds: "2099-12-07" })
      )
    ).toEqual({
      change: {
        action: "sale",
        mode: "amount",
        value: 50,
        starts_at: "2099-11-30T21:00:00.000Z",
        ends_at: "2099-12-07T20:59:59.000Z",
      },
    })
    expect(bulkChangeOf("sale", form({ saleMode: "clear", value: "9" }))).toEqual({
      change: { action: "sale", mode: "clear" },
    })
  })

  it("names a share of 100%, days out of order or an end already past on the field", () => {
    expect(bulkChangeOf("sale", form({ value: "100" }))).toEqual({
      error: "products.bulk.errors.fall",
    })
    expect(
      bulkChangeOf("sale", form({ value: "10", saleStarts: "2099-12-07", saleEnds: "2099-12-01" }))
    ).toEqual({ error: "products.bulk.errors.saleDates" })
    expect(bulkChangeOf("sale", form({ value: "10", saleEnds: "2020-01-01" }))).toEqual({
      error: "products.bulk.errors.saleEnded",
    })
  })

  it("shows a sale on an example price as the server works it out", () => {
    const change = bulkChangeOf("sale", form({ value: "25" }))
    expect("change" in change ? examplePrice(change.change, 100) : null).toBe(75)
    const off = bulkChangeOf("sale", form({ saleMode: "amount", value: "15" }))
    expect("change" in off ? examplePrice(off.change, 100) : null).toBe(85)
  })

  it("sets or takes off a brand, one picked", () => {
    expect(bulkChangeOf("brand", form({ brand: { id: "brand_1", label: "Usta" } }))).toEqual({
      change: { action: "brand", brand_id: "brand_1" },
    })
    expect(bulkChangeOf("brand", form({ brandMode: "clear" }))).toEqual({
      change: { action: "brand", brand_id: null },
    })
    expect(bulkChangeOf("brand", form({}))).toEqual({ error: "products.bulk.errors.brand" })
  })

  it("adds or removes a tag by its name, trimmed", () => {
    expect(bulkChangeOf("tag", form({ tag: "  Kış  " }))).toEqual({
      change: { action: "tag", mode: "add", value: "Kış" },
    })
    expect(bulkChangeOf("tag", form({ tagMode: "remove", tag: "Kış" }))).toEqual({
      change: { action: "tag", mode: "remove", value: "Kış" },
    })
    expect(bulkChangeOf("tag", form({ tag: " " }))).toEqual({ error: "products.bulk.errors.tag" })
  })

  it("turns selling past stock on or off", () => {
    expect(bulkChangeOf("backorder", form({}))).toEqual({
      change: { action: "backorder", allow: true },
    })
    expect(bulkChangeOf("backorder", form({ backorder: "deny" }))).toEqual({
      change: { action: "backorder", allow: false },
    })
  })
})
