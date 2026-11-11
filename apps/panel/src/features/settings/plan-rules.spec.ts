import { describe, expect, it } from "vitest"
import type { LimitStanding } from "@/features/settings/api/plan"
import { isFull, ratioOf, shownLimits, toneOf } from "./plan-rules"

const standing = (more: Partial<LimitStanding>): LimitStanding => ({
  key: "products",
  kind: "block",
  unit: "count",
  monthly: false,
  used: 0,
  max: 100,
  ...more,
})

describe("plan limit rules (adr/0061 Ek C14)", () => {
  it("reads use as ok below 80 %, warn from it, full at a blocking limit", () => {
    expect(toneOf(standing({ used: 79 }))).toBe("ok")
    expect(toneOf(standing({ used: 80 }))).toBe("warn")
    expect(toneOf(standing({ used: 100 }))).toBe("full")
    // Past it (a lowered package): still full, nothing is taken away
    expect(toneOf(standing({ used: 140 }))).toBe("full")
    expect(isFull(standing({ used: 100 }))).toBe(true)
    expect(isFull(undefined)).toBe(false)
  })

  it("never calls the month's orders full: past their limit they are only over", () => {
    const orders = standing({ key: "orders_per_month", kind: "warn", used: 12, max: 10 })
    expect(toneOf(orders)).toBe("over")
    expect(isFull(orders)).toBe(false)
  })

  it("has no tone and no bar without a limit or a count", () => {
    expect(toneOf(standing({ max: null, used: 9999 }))).toBe("ok")
    expect(ratioOf(standing({ max: null }))).toBeNull()
    expect(ratioOf(standing({ used: null }))).toBeNull()
    expect(ratioOf(standing({ used: 50 }))).toBe(0.5)
    expect(ratioOf(standing({ used: 150 }))).toBe(1)
    // A package of none: the bar is full, the first one refused
    expect(ratioOf(standing({ used: 0, max: 0 }))).toBe(1)
    expect(toneOf(standing({ used: 0, max: 0 }))).toBe("full")
  })

  it("lists every limit but the ones not applied yet", () => {
    expect(
      shownLimits([
        standing({}),
        standing({ key: "custom_domains", kind: "later", used: null, max: 1 }),
      ]).map((limit) => limit.key)
    ).toEqual(["products"])
  })
})
