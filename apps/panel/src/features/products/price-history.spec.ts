import { describe, expect, it } from "vitest"
import type { PriceDisplayView } from "./api/price-history"
import { priceSteps, ruleState } from "./price-history"

const NOW = new Date("2026-10-26T12:00:00.000Z")

const display = (fields: Partial<PriceDisplayView>): PriceDisplayView => ({
  current: "100.00",
  regular: "100.00",
  before: null,
  lowest_before: null,
  on_sale: false,
  since: null,
  basis: null,
  ...fields,
})

describe("priceSteps", () => {
  it("draws each change and today's price at the right edge", () => {
    const steps = priceSteps(
      [
        { at: "2026-08-01T00:00:00.000Z", amount: "100.00", original: "100.00" },
        { at: "2026-10-20T00:00:00.000Z", amount: "80.00", original: "100.00" },
      ],
      display({ current: "80.00" }),
      NOW
    )
    expect(steps).toEqual([
      { at: Date.parse("2026-08-01T00:00:00.000Z"), paid: 100, regular: 100 },
      { at: Date.parse("2026-10-20T00:00:00.000Z"), paid: 80, regular: 100 },
      { at: NOW.getTime(), paid: 80, regular: 100 },
    ])
  })

  it("carries the last price to today when the variant has no price now", () => {
    const steps = priceSteps(
      [{ at: "2026-09-01T00:00:00.000Z", amount: "50.00", original: "50.00" }],
      null,
      NOW
    )
    expect(steps.at(-1)).toEqual({ at: NOW.getTime(), paid: 50, regular: 50 })
    expect(priceSteps([], null, NOW)).toEqual([])
  })
})

describe("ruleState", () => {
  it.each([
    ["no discount", display({}), "none"],
    ["a discount struck through", display({ current: "80.00", on_sale: true }), "struck"],
    [
      "a discount the rule keeps plain",
      display({ current: "80.00", lowest_before: "80.00" }),
      "blocked",
    ],
  ] as const)("%s", (_case, value, expected) => {
    expect(ruleState(value)).toBe(expected)
  })
})
