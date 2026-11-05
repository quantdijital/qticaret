import { offerState } from "../offer-state"
import type { PromotionStateRow } from "../offer-state"

const NOW = new Date("2026-11-05T12:00:00.000Z")

// A 30% promotion every shopper gets on the products named, as Query reads it
const promotion = (over: Partial<PromotionStateRow> = {}): PromotionStateRow => ({
  code: "OTO30",
  type: "standard",
  status: "active",
  is_automatic: true,
  is_tax_inclusive: true,
  created_at: "2026-11-01T00:00:00.000Z",
  limit: null,
  used: 0,
  rules: [],
  application_method: {
    type: "percentage",
    target_type: "items",
    allocation: "across",
    value: 30,
    max_quantity: null,
    currency_code: null,
    target_rules: [
      { attribute: "items.product.id", operator: "in", values: [{ value: "prod_a" }] },
    ],
  },
  campaign: null,
  ...over,
})

const state = (rows: PromotionStateRow[], now = NOW) => offerState(rows, "try", now)

const campaign = (over: NonNullable<PromotionStateRow["campaign"]>) => ({
  campaign: { starts_at: null, ends_at: null, budget: null, ...over },
})

describe("the automatic promotions' key for the index's minute (adr/0023 Ek 2026-11-05)", () => {
  it("stays the same for the same promotions, whatever their order or their values' order", () => {
    const other = promotion({
      code: "OTO10",
      application_method: {
        ...promotion().application_method,
        value: 10,
        target_rules: [
          {
            attribute: "items.product.id",
            operator: "in",
            values: [{ value: "prod_b" }, { value: "prod_c" }],
          },
        ],
      },
    })
    const turned = promotion({
      code: "OTO10",
      application_method: {
        ...other.application_method,
        target_rules: [
          {
            attribute: "items.product.id",
            operator: "in",
            values: [{ value: "prod_c" }, { value: "prod_b" }],
          },
        ],
      },
    })
    expect(state([promotion(), other])).toBe(state([turned, promotion()]))
    expect(state([promotion()])).toMatch(/^[0-9a-f]{64}$/)
  })

  it("changes when a promotion that is a price comes, goes, or takes another amount or target", () => {
    const base = state([promotion()])
    expect(state([])).not.toBe(base)
    expect(
      state([promotion({ application_method: { ...promotion().application_method, value: 25 } })])
    ).not.toBe(base)
    expect(
      state([
        promotion({
          application_method: {
            ...promotion().application_method,
            target_rules: [
              { attribute: "items.product.id", operator: "in", values: [{ value: "prod_z" }] },
            ],
          },
        }),
      ])
    ).not.toBe(base)
    // Drafted: no longer a price
    expect(state([promotion({ status: "draft" })])).toBe(state([]))
  })

  it("ignores what is never a price before the cart: a code's, a cart minimum's", () => {
    const base = state([promotion()])
    expect(state([promotion(), promotion({ code: "KOD20", is_automatic: false })])).toBe(base)
    expect(
      state([
        promotion(),
        promotion({
          code: "ESIK10",
          rules: [{ attribute: "item_total", operator: "gte", values: [{ value: "2000" }] }],
        }),
      ])
    ).toBe(base)
  })

  it("changes as the campaign begins and ends, with no write to tell of it", () => {
    const dated = [
      promotion(
        campaign({ starts_at: "2026-11-06T00:00:00.000Z", ends_at: "2026-11-10T00:00:00.000Z" })
      ),
    ]
    const before = state(dated, NOW)
    const during = state(dated, new Date("2026-11-07T00:00:00.000Z"))
    const after = state(dated, new Date("2026-11-11T00:00:00.000Z"))
    expect(during).not.toBe(before)
    expect(after).not.toBe(during)
    // A minute later inside the same stretch: nothing to do
    expect(state(dated, new Date("2026-11-07T00:01:00.000Z"))).toBe(during)
  })

  it("changes once a limit or a budget is used up, not with each use before it", () => {
    const limited = (used: number) => [promotion({ limit: 100, used })]
    expect(state(limited(3))).toBe(state(limited(4)))
    expect(state(limited(100))).not.toBe(state(limited(99)))

    const budget = (used: number) => [
      promotion(campaign({ budget: { type: "spend", limit: 5000, used } })),
    ]
    expect(state(budget(1200))).toBe(state(budget(1300)))
    expect(state(budget(5000))).not.toBe(state(budget(1300)))
  })
})
