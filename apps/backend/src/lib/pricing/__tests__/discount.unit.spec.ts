import type { Kurus } from "../../money"
import { DISCOUNT_RULE, discountView } from "../discount"
import type { PricePoint } from "../discount"

const NOW = new Date("2026-10-26T12:00:00.000Z").getTime()
const DAY = 24 * 60 * 60 * 1000
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY)
const point = (daysAgo: number, amount: number, original = amount): PricePoint => ({
  at: at(daysAgo),
  amount: amount as Kurus,
  original: original as Kurus,
})

describe("the price before a discount (ADR-0023)", () => {
  it("shows no discount at the regular price", () => {
    expect(discountView([point(40, 10000), point(5, 12000)])).toMatchObject({
      current: 12000,
      discounted: false,
      before: null,
      rule: DISCOUNT_RULE.version,
    })
    expect(discountView([])).toBeNull()
  })

  it("takes the lowest price of the 30 days before the discount began", () => {
    const view = discountView([
      point(60, 9000), // in force when the window opened (10 days before it)
      point(35, 12000),
      point(20, 11000),
      point(10, 8000, 12000),
    ])
    expect(view).toMatchObject({
      current: 8000,
      regular: 12000,
      discounted: true,
      since: at(10),
      before: 9000,
      basis: "history",
    })
  })

  it("leaves out a price whose time ended before the window", () => {
    const view = discountView([point(80, 7000), point(45, 12000), point(5, 9000, 12000)])
    expect(view?.before).toBe(12000)
  })

  it("counts an earlier discount inside the window", () => {
    const view = discountView([
      point(50, 12000),
      point(25, 9500, 12000),
      point(20, 12000),
      point(3, 10000, 12000),
    ])
    expect(view).toMatchObject({ since: at(3), before: 9500 })
  })

  it("keeps a deepening discount's start, so its price before stays", () => {
    const view = discountView([point(40, 12000), point(10, 10000, 12000), point(2, 8000, 12000)])
    expect(view).toMatchObject({ current: 8000, since: at(10), before: 12000 })
  })

  it("begins a new discount where a sale price went up, measured against the lower one", () => {
    // 120 regular, a list at 70, then a list at 90 with no regular price between
    const risen = discountView([point(70, 12000), point(20, 7000, 12000), point(5, 9000, 12000)])
    expect(risen).toMatchObject({ current: 9000, since: at(5), before: 7000, basis: "history" })
    // A deepening after the rise is measured from the rise's start
    const deepened = discountView([
      point(70, 12000),
      point(20, 8000, 12000),
      point(10, 8500, 12000),
      point(2, 7000, 12000),
    ])
    expect(deepened).toMatchObject({ current: 7000, since: at(10), before: 8000 })
  })

  it("falls back to the regular price when history starts inside the discount", () => {
    expect(discountView([point(3, 8000, 12000)])).toMatchObject({
      discounted: true,
      before: 12000,
      basis: "regular",
    })
  })
})
