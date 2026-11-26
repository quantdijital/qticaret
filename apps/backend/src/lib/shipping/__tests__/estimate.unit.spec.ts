import { ValidationError } from "../../errors"
import { kurus } from "../../money"
import type { Kurus } from "../../money"
import { estimateShipping, primaryOptionOf } from "../estimate"
import type { EstimatePricer, ListedOption } from "../estimate"
import type { QuoteLine, ShippingQuoteContext } from "../quote"

interface Line extends QuoteLine {
  desi: number
}

const line = (product: string, desi = 1, requires_shipping = true): Line => ({
  product_id: product,
  desi,
  requires_shipping,
})

const context = (over: Partial<ShippingQuoteContext> = {}): ShippingQuoteContext => ({
  threshold: kurus(150_000),
  item_total: kurus(60_000),
  classes: {},
  surcharges: { bulky: kurus(15_000) },
  ...over,
})

const FLAT: EstimatePricer<Line> = { basis: "order", price: () => kurus(9_000) }
// 10 TL a desi
const TABLE: EstimatePricer<Line> = {
  basis: "parcel",
  price: (lines) => kurus(lines.reduce((sum, each) => sum + each.desi, 0) * 1_000),
}

const estimate = (
  lines: Line[],
  pricer: EstimatePricer<Line> | null,
  ctx: ShippingQuoteContext | null = context(),
  hasOption = true
) => estimateShipping({ lines, context: ctx, pricer, hasOption })

describe("the cart's shipping estimate (before an address)", () => {
  it("prices a flat amount per order and the table by the parcel", async () => {
    expect(await estimate([line("p1", 3)], FLAT)).toEqual({
      status: "priced",
      amount: kurus(9_000),
    })
    expect(await estimate([line("p1", 3)], TABLE)).toEqual({
      status: "priced",
      amount: kurus(3_000),
    })
  })

  it("is free at the threshold, its surcharge gone too", async () => {
    const ctx = context({ item_total: kurus(150_000), classes: { p1: "bulky" } })
    expect(await estimate([line("p1")], FLAT, ctx)).toEqual({ status: "free" })
  })

  it("adds the class surcharge below the threshold", async () => {
    const ctx = context({ classes: { p1: "bulky" } })
    expect(await estimate([line("p1")], FLAT, ctx)).toEqual({
      status: "priced",
      amount: kurus(24_000),
    })
  })

  it("is free for a basket of free products, whatever the option", async () => {
    const ctx = context({ classes: { p1: "free" } })
    expect(await estimate([line("p1")], FLAT, ctx)).toEqual({ status: "free" })
    // A carrier's quote is never asked for it
    expect(await estimate([line("p1")], null, ctx)).toEqual({ status: "free" })
  })

  it("leaves a carrier's quote to the checkout unless the basket ships free", async () => {
    expect(await estimate([line("p1")], null)).toEqual({ status: "at_checkout" })
    const past = context({ item_total: kurus(200_000) })
    expect(await estimate([line("p1")], null, past)).toEqual({ status: "free" })
  })

  it("leaves a parcel the table refuses to the checkout; a fault is thrown", async () => {
    const refused: EstimatePricer<Line> = {
      basis: "parcel",
      price: () => {
        throw new ValidationError("shipping.no_rate")
      },
    }
    expect(await estimate([line("p1", 90)], refused)).toEqual({ status: "at_checkout" })
    const broken: EstimatePricer<Line> = {
      basis: "parcel",
      price: (): Kurus => {
        throw new Error("database gone")
      },
    }
    await expect(estimate([line("p1")], broken)).rejects.toThrow("database gone")
  })

  it("says nothing travels, and checkout without an option", async () => {
    expect(await estimate([line("p1", 1, false)], FLAT)).toEqual({ status: "not_needed" })
    expect(await estimate([], FLAT)).toEqual({ status: "not_needed" })
    expect(await estimate([line("p1")], null, context(), false)).toEqual({
      status: "at_checkout",
    })
  })

  it("charges the base when the context is missing", async () => {
    expect(await estimate([line("p1")], FLAT, null)).toEqual({
      status: "priced",
      amount: kurus(9_000),
    })
  })
})

describe("the shop's main option", () => {
  const option = (over: Partial<ListedOption>): ListedOption => ({
    id: "so_1",
    name: "Standart",
    carrier: "manual",
    pricing: "flat",
    amount: "90.00",
    in_store: true,
    ...over,
  })

  it("is the saved one while shoppers are offered it", () => {
    const options = [option({ id: "a", amount: "50.00" }), option({ id: "b", pricing: "table" })]
    expect(primaryOptionOf(options, "b")?.id).toBe("b")
    const hidden = [option({ id: "a" }), option({ id: "b", in_store: false })]
    expect(primaryOptionOf(hidden, "b")?.id).toBe("a")
  })

  it("is else the cheapest flat one that delivers, else the first that does", () => {
    const options = [
      option({ id: "pickup", carrier: "pickup", amount: "0.00" }),
      option({ id: "dear", amount: "120.00" }),
      option({ id: "cheap", amount: "59.90" }),
    ]
    expect(primaryOptionOf(options, null)?.id).toBe("cheap")
    expect(primaryOptionOf(options, "gone")?.id).toBe("cheap")
    expect(
      primaryOptionOf([option({ id: "geliver", carrier: "geliver", pricing: "cheapest" })], null)
        ?.id
    ).toBe("geliver")
    expect(primaryOptionOf([option({ carrier: "pickup" })], null)).toBeNull()
  })
})
