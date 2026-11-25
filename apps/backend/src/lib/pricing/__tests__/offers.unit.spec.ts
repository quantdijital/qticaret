import type { Kurus } from "../../money"
import { priceDisplay } from "../display"
import type { PricePoint } from "../discount"
import { isLimited, offerDiscount, offerOf, offerPrice, pricesWithOffers } from "../offers"
import type { PriceOffer, PromotionRow } from "../offers"

const NOW = new Date("2026-11-05T12:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY)
const k = (value: number) => value as Kurus
const point = (daysAgo: number, amount: number, original = amount): PricePoint => ({
  at: at(daysAgo),
  amount: k(amount),
  original: k(original),
})

// The panel's automatic "30% off the basket" (features/promotions/offer.ts)
const promotion = (over: Partial<PromotionRow> = {}): PromotionRow => ({
  code: "SEPET30",
  type: "standard",
  status: "active",
  is_automatic: true,
  is_tax_inclusive: true,
  created_at: at(3).toISOString(),
  rules: [],
  application_method: { type: "percentage", target_type: "order", allocation: "across", value: 30 },
  campaign: null,
  ...over,
})

describe("which automatic promotions show before the cart (adr/0023 Ek 2026-11-05)", () => {
  it("makes an offer every shopper gets the price, from its earliest start", () => {
    expect(offerOf(promotion(), "try")).toEqual({
      kind: "price",
      code: "SEPET30",
      method: { type: "percentage", value: 30 },
      since: at(3),
    })
    // A campaign that began after the promotion was made starts it later
    const later = offerOf(promotion({ campaign: { starts_at: at(1).toISOString() } }), "try")
    expect(later).toMatchObject({ kind: "price", since: at(1) })
    // A rule on the shop's own currency is no condition
    const priced = promotion({
      rules: [{ attribute: "currency_code", operator: "eq", values: [{ value: "TRY" }] }],
    })
    expect(offerOf(priced, "try")).toMatchObject({ kind: "price" })
  })

  it("names an offer past a cart minimum beside the price, never as the price", () => {
    const minimum = promotion({
      rules: [{ attribute: "item_total", operator: "gte", values: [{ value: "500" }] }],
    })
    expect(offerOf(minimum, "try")).toEqual({
      kind: "cart",
      code: "SEPET30",
      method: { type: "percentage", value: 30 },
      minimum: 50000,
    })
    // An amount off the whole basket depends on the basket: a cart offer too
    const amount = promotion({
      application_method: {
        type: "fixed",
        target_type: "order",
        allocation: "across",
        value: 50,
        currency_code: "try",
      },
    })
    expect(offerOf(amount, "try")).toMatchObject({
      kind: "cart",
      method: { type: "fixed", value: 5000 },
      minimum: null,
    })
  })

  it("takes an amount off each unit, KDV included, as the price", () => {
    const each = promotion({
      application_method: {
        type: "fixed",
        target_type: "items",
        allocation: "each",
        value: 25.5,
        currency_code: "try",
      },
    })
    expect(offerOf(each, "try")).toMatchObject({
      kind: "price",
      method: { type: "fixed", value: 2550 },
    })
    expect(offerOf({ ...each, is_tax_inclusive: false }, "try")).toMatchObject({ kind: "cart" })
    // Another currency's amount never applies here
    expect(offerOf(each, "eur")).toBeNull()
  })

  it("leaves in the cart what depends on the shopper or is no discount on the price", () => {
    const cases: Partial<PromotionRow>[] = [
      { is_automatic: false },
      { status: "draft" },
      { type: "buyget" },
      { rules: [{ attribute: "customer.groups.id", operator: "in", values: [{ value: "g1" }] }] },
      { rules: [{ attribute: "region.id", operator: "in", values: [{ value: "reg_1" }] }] },
      { rules: [{ attribute: "currency_code", operator: "in", values: [{ value: "eur" }] }] },
      { campaign: { budget: { type: "use_by_attribute" } } },
      // A limit that can run out between the card and the cart (adr/0076 Ek 2026-11-25)
      { campaign: { budget: { type: "spend", limit: 50_000 } } },
      { campaign: { budget: { type: "usage", limit: "100" } } },
      { campaign: { budget: { type: "spend_by_attribute", limit: 500 } } },
      { limit: 10 },
      { limit: 0 },
      {
        application_method: {
          type: "percentage",
          target_type: "shipping_methods",
          allocation: "each",
          value: 100,
        },
      },
      { application_method: { type: "percentage", target_type: "order", value: 0 } },
    ]
    for (const over of cases) {
      expect(offerOf(promotion(over), "try")).toBeNull()
    }
    // A per-unit cap: the second unit would not get it
    const capped = promotion({
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        value: 30,
        max_quantity: 1,
      },
    })
    expect(offerOf(capped, "try")).toMatchObject({ kind: "cart" })
  })

  it("shows a budget only once it has no limit; a limited one is not even a cart offer", () => {
    // Medusa holds a promotion to its campaign's budget only once the budget has a limit
    expect(isLimited(promotion({ campaign: { budget: { type: "spend", limit: null } } }))).toBe(
      false
    )
    expect(isLimited(promotion({ campaign: { budget: { type: "spend", limit: 0 } } }))).toBe(false)
    expect(isLimited(promotion({ limit: null }))).toBe(false)
    const open = promotion({ campaign: { budget: { type: "usage", limit: null } } })
    expect(offerOf(open, "try")).toMatchObject({ kind: "price" })
    const minimum = promotion({
      rules: [{ attribute: "item_total", operator: "gte", values: [{ value: "500" }] }],
      campaign: { budget: { type: "spend", limit: 1000 } },
    })
    expect(offerOf(minimum, "try")).toBeNull()
  })
})

describe("a price after its offers", () => {
  it("counts each on the whole price, together never more than it", () => {
    expect(offerPrice(k(174900), [{ type: "percentage", value: 30 }])).toBe(122430)
    expect(offerDiscount(k(89999), [{ type: "percentage", value: 30 }])).toBe(27000)
    expect(
      offerPrice(k(10000), [
        { type: "percentage", value: 60 },
        { type: "fixed", value: k(5000) },
      ])
    ).toBe(0)
  })
})

describe("the prices paid with an offer (the price before it never overstated)", () => {
  const thirty: PriceOffer = {
    kind: "price",
    code: "SEPET30",
    method: { type: "percentage", value: 30 },
    since: at(3),
  }

  it("strikes through the lowest price of the 10 days before the offer began", () => {
    const history = [point(40, 174900), point(12, 159900), point(8, 174900)]
    const paid = pricesWithOffers(history, [thirty])
    // The price in force when it began is a point of its own then
    expect(paid.at(-1)).toEqual({ at: at(3), amount: 122430, original: 174900 })
    const shown = priceDisplay(paid, { amount: k(122430), original: k(174900) }, NOW)
    expect(shown).toMatchObject({
      current: 122430,
      regular: 174900,
      before: 159900,
      on_sale: true,
      since: at(3),
      basis: "history",
    })
  })

  it("strikes through the regular price when the history begins inside the offer", () => {
    const shown = priceDisplay(
      pricesWithOffers([], [thirty]),
      { amount: k(122430), original: k(174900) },
      NOW
    )
    expect(shown).toMatchObject({ current: 122430, before: 174900, basis: "regular" })
  })

  it("shows no discount when the offer only brings the price back to one of the last 10 days", () => {
    // 1.224,30 sold a week ago; raised to 1.749 since, then "30% off"
    const history = [point(30, 122430), point(5, 174900)]
    const shown = priceDisplay(
      pricesWithOffers(history, [thirty]),
      { amount: k(122430), original: k(174900) },
      NOW
    )
    expect(shown).toMatchObject({ current: 122430, before: null, on_sale: false })
  })

  it("applies the offer to the prices set after it began", () => {
    const paid = pricesWithOffers([point(20, 100000), point(1, 200000)], [thirty])
    expect(paid.map((each) => each.amount)).toEqual([100000, 70000, 140000])
  })
})
