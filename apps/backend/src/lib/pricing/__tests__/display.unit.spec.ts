import type { Kurus } from "../../money"
import { DISCOUNT_RULE, priceDisplay } from ".."
import type { PricePoint } from ".."

const NOW = new Date("2026-10-26T12:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY)
const point = (daysAgo: number, amount: number, original = amount): PricePoint => ({
  at: at(daysAgo),
  amount: amount as Kurus,
  original: original as Kurus,
})
const live = (amount: number, original = amount) => ({
  amount: amount as Kurus,
  original: original as Kurus,
})

describe("how a price is shown (F4.3, ADR-0023)", () => {
  it("shows a discount struck through at the lowest price of the 30 days before it", () => {
    const shown = priceDisplay(
      [point(60, 10000), point(20, 9500), point(5, 8000, 10000)],
      live(8000, 10000),
      NOW
    )
    expect(shown).toEqual({
      current: 8000,
      regular: 10000,
      before: 9500,
      lowest_before: 9500,
      on_sale: true,
      since: at(5),
      basis: "history",
      rule_version: DISCOUNT_RULE.version,
    })
  })

  it("shows no discount when the price was as low within 30 days", () => {
    // Raised to 100 a week ago, then "discounted" back to 80: nothing to advertise
    const shown = priceDisplay(
      [point(40, 8000), point(7, 10000), point(2, 8000, 10000)],
      live(8000, 10000),
      NOW
    )
    expect(shown).toMatchObject({
      current: 8000,
      regular: 10000,
      before: null,
      lowest_before: 8000,
      on_sale: false,
    })
  })

  it("shows the regular price alone when there is no discount", () => {
    expect(priceDisplay([point(10, 10000)], live(10000), NOW)).toMatchObject({
      current: 10000,
      before: null,
      on_sale: false,
      since: null,
      basis: null,
    })
  })

  it("counts a sale the history has not caught yet from now", () => {
    // A list that began a minute ago: the hourly check has not written it
    const shown = priceDisplay([point(60, 10000)], live(7000, 10000), NOW)
    expect(shown).toMatchObject({ current: 7000, before: 10000, on_sale: true, since: NOW })
  })

  it("falls back to the regular price for a shop whose history begins inside the sale", () => {
    expect(priceDisplay([point(3, 7000, 10000)], live(7000, 10000), NOW)).toMatchObject({
      before: 10000,
      on_sale: true,
      basis: "regular",
    })
  })

  it("shows a price with no history at all", () => {
    expect(priceDisplay([], live(5000), NOW)).toMatchObject({ current: 5000, on_sale: false })
  })
})
