import { kurus } from "../../money"
import {
  QUOTE_CONTEXT_KEY,
  itemTotalKurus,
  quoteContextOf,
  reachesThreshold,
  shippingQuote,
  thresholdKurus,
} from "../quote"

const LINES = [{ quantity: 1 }]

describe("the one shipping quote (adr/0087 §2)", () => {
  it("charges the option's own price under the threshold", async () => {
    const price = jest.fn(() => kurus(4_990))
    const amount = await shippingQuote({
      lines: LINES,
      context: { threshold: kurus(20_000), item_total: kurus(19_999) },
      price,
    })
    expect(amount).toBe(4_990)
    expect(price).toHaveBeenCalledWith(LINES)
  })

  it("makes every option free from the threshold, exactly the threshold counting, without asking for the base", async () => {
    const price = jest.fn(() => Promise.resolve(kurus(6_000)))
    for (const total of [20_000, 50_000]) {
      expect(
        await shippingQuote({
          lines: LINES,
          context: { threshold: kurus(20_000), item_total: kurus(total) },
          price,
        })
      ).toBe(0)
    }
    expect(price).not.toHaveBeenCalled()
  })

  it("charges the base without a threshold, or without the hook's reading", async () => {
    const price = () => kurus(4_990)
    expect(
      await shippingQuote({
        lines: LINES,
        context: { threshold: null, item_total: kurus(900_000) },
        price,
      })
    ).toBe(4_990)
    expect(await shippingQuote({ lines: LINES, context: null, price })).toBe(4_990)
  })

  it("passes a refusal of the base on (no rate, no offer)", async () => {
    await expect(
      shippingQuote({
        lines: LINES,
        context: null,
        price: () => Promise.reject(new Error("shipping.no_rate")),
      })
    ).rejects.toThrow("shipping.no_rate")
  })
})

describe("the hook's reading in a provider's context", () => {
  it("reads our key alone, in kuruş", () => {
    expect(
      quoteContextOf({
        id: "cart_1",
        items: [],
        [QUOTE_CONTEXT_KEY]: { threshold: 20_000, item_total: 24_000 },
      })
    ).toEqual({ threshold: 20_000, item_total: 24_000 })
    expect(quoteContextOf({ [QUOTE_CONTEXT_KEY]: { threshold: null, item_total: 0 } })).toEqual({
      threshold: null,
      item_total: 0,
    })
  })

  it("reads nothing out of shape: nothing is then free", () => {
    for (const context of [
      null,
      {},
      { [QUOTE_CONTEXT_KEY]: "free" },
      { [QUOTE_CONTEXT_KEY]: { threshold: 0 } },
      { [QUOTE_CONTEXT_KEY]: { threshold: 100, item_total: -1 } },
      { [QUOTE_CONTEXT_KEY]: { threshold: 100, item_total: 1.5 } },
      { [QUOTE_CONTEXT_KEY]: { threshold: 100, item_total: "500" } },
    ]) {
      expect(reachesThreshold(quoteContextOf(context))).toBe(false)
    }
    // A threshold that is not a kuruş amount is no threshold
    expect(quoteContextOf({ [QUOTE_CONTEXT_KEY]: { threshold: -5, item_total: 100 } })).toEqual({
      threshold: null,
      item_total: 100,
    })
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
