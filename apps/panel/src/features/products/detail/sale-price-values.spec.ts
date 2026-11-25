import { describe, expect, it } from "vitest"
import {
  bulkSaleChange,
  checkSale,
  EMPTY_SALE,
  saleChangeOf,
  saleDraftOf,
  sameDraft,
} from "./sale-price-values"

const draft = (over: Partial<typeof EMPTY_SALE>) => ({ ...EMPTY_SALE, ...over })

/** adr/0086: Woo's "İndirimli fiyat" and "Zamanla" on a variant. */
describe("a variant's sale price field", () => {
  it("starts from the stored sale, its days as Turkey's days", () => {
    expect(
      saleDraftOf({
        amount: "1249.90",
        starts_at: "2026-11-30T21:00:00.000Z",
        ends_at: "2026-12-07T20:59:59.000Z",
        running: false,
      })
    ).toEqual({ amount: "1.249,90", scheduled: true, starts: "2026-12-01", ends: "2026-12-07" })
    expect(saleDraftOf(null)).toEqual(EMPTY_SALE)
  })

  it("is unchanged by the same price typed another way, changed by other days", () => {
    const stored = draft({ amount: "1.250,00" })
    expect(sameDraft(draft({ amount: "1250" }), stored)).toBe(true)
    expect(sameDraft(draft({ amount: "1250", scheduled: true, ends: "2099-01-01" }), stored)).toBe(
      false
    )
    // Days typed but the schedule closed again: nothing to save
    expect(sameDraft(draft({ amount: "1250", starts: "2099-01-01" }), stored)).toBe(true)
  })

  it("says the share off, and refuses what is no sale", () => {
    expect(checkSale(draft({ amount: "80" }), 100)).toEqual({ error: null, percent: 20 })
    expect(checkSale(draft({ amount: "" }), 100)).toEqual({ error: null, percent: null })
    expect(checkSale(draft({ amount: "100" }), 100).error).toBe("notBelow")
    expect(checkSale(draft({ amount: "120" }), 100).error).toBe("notBelow")
    expect(checkSale(draft({ amount: "abc" }), 100).error).toBe("amount")
    expect(checkSale(draft({ amount: "80" }), null).error).toBe("noRegular")
    expect(
      checkSale(
        draft({ amount: "80", scheduled: true, starts: "2099-02-01", ends: "2099-01-01" }),
        100
      ).error
    ).toBe("datesOrder")
    expect(checkSale(draft({ amount: "80", scheduled: true, ends: "2020-01-01" }), 100).error).toBe(
      "ended"
    )
  })

  it("sends the price in lira with the days' first and last second, or clears it", () => {
    expect(
      saleChangeOf(
        "variant_a",
        draft({ amount: "1.249,9", scheduled: true, starts: "2026-12-01", ends: "2026-12-07" })
      )
    ).toEqual({
      set: [
        {
          variant_id: "variant_a",
          amount: "1249.90",
          starts_at: "2026-11-30T21:00:00.000Z",
          ends_at: "2026-12-07T20:59:59.000Z",
        },
      ],
    })
    expect(saleChangeOf("variant_a", draft({ amount: "80", starts: "2026-12-01" }))).toEqual({
      set: [{ variant_id: "variant_a", amount: "80.00", starts_at: null, ends_at: null }],
    })
    expect(saleChangeOf("variant_a", EMPTY_SALE)).toEqual({ clear: ["variant_a"] })
  })
})

describe("the bulk bar's sale price", () => {
  const ids = ["variant_a", "variant_b"]
  const bulk = { value: "", starts: "", ends: "" }

  it("sends a percentage for the server to work out, a price, or a clear", () => {
    expect(bulkSaleChange(ids, { ...bulk, mode: "percent", value: "15" })).toEqual({
      set: ids.map((variant_id) => ({ variant_id, percent: 15, starts_at: null, ends_at: null })),
    })
    expect(bulkSaleChange(ids, { ...bulk, mode: "price", value: "99,90" })?.set?.[0]).toEqual({
      variant_id: "variant_a",
      amount: "99.90",
      starts_at: null,
      ends_at: null,
    })
    expect(bulkSaleChange(ids, { ...bulk, mode: "clear" })).toEqual({ clear: ids })
    expect(bulkSaleChange(ids, { ...bulk, mode: "percent", value: "100" })).toBeNull()
    expect(bulkSaleChange(ids, { ...bulk, mode: "price", value: "0" })).toBeNull()
  })
})
