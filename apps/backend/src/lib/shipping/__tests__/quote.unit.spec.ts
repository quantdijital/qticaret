import { kurus } from "../../money"
import type { Kurus } from "../../money"
import {
  QUOTE_CONTEXT_KEY,
  itemTotalKurus,
  quoteContextOf,
  reachesThreshold,
  shippingQuote,
  thresholdKurus,
} from "../quote"
import type { QuoteBasis, QuoteLine, ShippingQuoteContext } from "../quote"

interface Line extends QuoteLine {
  desi: number
}

const line = (product: string, desi = 1, requires_shipping = true): Line => ({
  product_id: product,
  desi,
  requires_shipping,
})

const context = (over: Partial<ShippingQuoteContext> = {}): ShippingQuoteContext => ({
  threshold: null,
  item_total: kurus(10_000),
  classes: {},
  surcharges: { bulky: kurus(15_000), heavy: kurus(25_000) },
  ...over,
})

// The table: 10 TL a desi; a flat amount: 59.90
const byDesi = (lines: readonly Line[]): Kurus =>
  kurus(lines.reduce((sum, each) => sum + each.desi, 0) * 1_000)
const quote = (
  lines: Line[],
  ctx: ShippingQuoteContext | null,
  basis: QuoteBasis,
  price: (lines: readonly Line[]) => Kurus | Promise<Kurus> = basis === "order"
    ? () => kurus(5_990)
    : byDesi
) => shippingQuote({ lines, context: ctx, basis, price })

describe("the one shipping quote (adr/0087 §2)", () => {
  it("charges the option's own price under the threshold", async () => {
    const price = jest.fn(byDesi)
    const lines = [line("prod_a", 2)]
    expect(
      await quote(
        lines,
        context({ threshold: kurus(20_000), item_total: kurus(19_999) }),
        "parcel",
        price
      )
    ).toBe(2_000)
    expect(price).toHaveBeenCalledWith(lines)
  })

  it("makes every option free from the threshold, exactly the threshold counting, without asking for the base", async () => {
    const price = jest.fn(() => Promise.resolve(kurus(6_000)))
    for (const total of [20_000, 50_000]) {
      for (const basis of ["order", "parcel"] as const) {
        expect(
          await quote(
            [line("prod_a")],
            context({ threshold: kurus(20_000), item_total: kurus(total) }),
            basis,
            price
          )
        ).toBe(0)
      }
    }
    expect(price).not.toHaveBeenCalled()
  })

  it("charges the base without a threshold, or without the hook's reading", async () => {
    expect(await quote([line("prod_a")], context({ item_total: kurus(900_000) }), "order")).toBe(
      5_990
    )
    expect(await quote([line("prod_a")], null, "order")).toBe(5_990)
  })

  it("passes a refusal of the base on (no rate, no offer)", async () => {
    await expect(
      quote([line("prod_a")], null, "parcel", () => Promise.reject(new Error("shipping.no_rate")))
    ).rejects.toThrow("shipping.no_rate")
  })
})

describe("free-shipping products and classes (adr/0087 §2, the owner's answers)", () => {
  it("ships a basket of free products free with every kind of option, without asking for the base", async () => {
    const price = jest.fn(() => kurus(5_990))
    const ctx = context({ classes: { prod_a: "free", prod_b: "free" } })
    for (const basis of ["order", "parcel"] as const) {
      expect(await quote([line("prod_a"), line("prod_b", 3)], ctx, basis, price)).toBe(0)
    }
    expect(price).not.toHaveBeenCalled()
  })

  it("prices a mixed basket by the paid lines' parcel, a flat amount in full (answers 1, 2)", async () => {
    const ctx = context({ classes: { prod_free: "free" } })
    const lines = [line("prod_free", 5), line("prod_paid", 2)]
    // The free product's 5 desi adds nothing to the table or a quote
    expect(await quote(lines, ctx, "parcel")).toBe(2_000)
    // A flat amount is per order: paid in full
    expect(await quote(lines, ctx, "order")).toBe(5_990)
  })

  it("adds the highest surcharge of the paid lines once, never per unit or class (answer 3)", async () => {
    const ctx = context({ classes: { prod_a: "bulky", prod_b: "heavy", prod_c: "bulky" } })
    const lines = [line("prod_a"), line("prod_b"), line("prod_c")]
    expect(await quote(lines, ctx, "order")).toBe(5_990 + 25_000)
    expect(await quote(lines, ctx, "parcel")).toBe(3_000 + 25_000)
  })

  it("takes no surcharge for a free line, and drops it past the threshold", async () => {
    const ctx = context({ classes: { prod_free: "free", prod_bulky: "bulky" } })
    expect(await quote([line("prod_free"), line("prod_std")], ctx, "order")).toBe(5_990)
    expect(
      await quote(
        [line("prod_bulky"), line("prod_std")],
        { ...ctx, threshold: kurus(5_000), item_total: kurus(5_000) },
        "order"
      )
    ).toBe(0)
  })

  it("counts free products toward the threshold: the whole basket (answer 6)", async () => {
    // The hook's item_total is the cart's: free products' amounts are in it
    const ctx = context({
      classes: { prod_free: "free" },
      threshold: kurus(15_000),
      item_total: kurus(15_000),
    })
    expect(await quote([line("prod_free"), line("prod_paid")], ctx, "order")).toBe(0)
  })

  it("leaves out a line that does not travel, and reads a removed class as Standard", async () => {
    const ctx = context({ classes: { prod_digital: "heavy", prod_old: "gone" } })
    const digital = line("prod_digital", 1, false)
    expect(await quote([digital, line("prod_std", 2)], ctx, "parcel")).toBe(2_000)
    expect(await quote([line("prod_old")], ctx, "order")).toBe(5_990)
    // A cart of nothing that travels with only free lines elsewhere: the base as before
    expect(await quote([digital], context({ classes: { prod_digital: "free" } }), "order")).toBe(
      5_990
    )
  })

  it("reads a removed class named like an object's own property as Standard (security review)", async () => {
    const ctx = context({ classes: { prod_a: "constructor", prod_b: "tostring" } })
    expect(await quote([line("prod_a"), line("prod_b")], ctx, "order")).toBe(5_990)
  })
})

describe("the hook's reading in a provider's context", () => {
  it("reads our key alone, in kuruş", () => {
    expect(
      quoteContextOf({
        id: "cart_1",
        items: [],
        [QUOTE_CONTEXT_KEY]: {
          threshold: 20_000,
          item_total: 24_000,
          classes: { prod_a: "free", prod_b: 3 },
          surcharges: { bulky: 15_000, bad: -1 },
        },
      })
    ).toEqual({
      threshold: 20_000,
      item_total: 24_000,
      classes: { prod_a: "free" },
      surcharges: { bulky: 15_000 },
    })
  })

  it("reads nothing out of shape: nothing is then free", () => {
    for (const read of [
      null,
      {},
      { [QUOTE_CONTEXT_KEY]: "free" },
      { [QUOTE_CONTEXT_KEY]: { threshold: 0 } },
      { [QUOTE_CONTEXT_KEY]: { threshold: 100, item_total: -1 } },
      { [QUOTE_CONTEXT_KEY]: { threshold: 100, item_total: 1.5 } },
      { [QUOTE_CONTEXT_KEY]: { threshold: 100, item_total: "500" } },
    ]) {
      expect(reachesThreshold(quoteContextOf(read))).toBe(false)
    }
    expect(
      quoteContextOf({ [QUOTE_CONTEXT_KEY]: { threshold: -5, item_total: 100 } })?.threshold
    ).toBeNull()
  })
})

describe("amounts the hook reads", () => {
  it("takes the threshold in lira, off when not above zero", () => {
    expect(thresholdKurus(1_500)).toBe(150_000)
    expect(thresholdKurus(249.99)).toBe(24_999)
    expect(thresholdKurus(null)).toBeNull()
    expect(thresholdKurus(0)).toBeNull()
    expect(thresholdKurus(Number.NaN)).toBeNull()
  })

  it("takes the basket total in lira, never below zero", () => {
    expect(itemTotalKurus(240)).toBe(24_000)
    expect(itemTotalKurus("191.995")).toBe(19_200)
    expect(itemTotalKurus(null)).toBe(0)
    expect(itemTotalKurus(-10)).toBe(0)
  })
})
