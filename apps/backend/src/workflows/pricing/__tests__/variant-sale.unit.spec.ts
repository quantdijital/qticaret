import { kurus } from "../../../lib/money"
import { isVariantSaleMeta, planVariantSales, shownSale } from "../variant-sale/plan"
import type { ExistingSale, SaleContext, VariantSaleInput } from "../variant-sale/plan"

const NOW = new Date("2026-11-25T12:00:00.000Z")
const lira = (value: number) => kurus(Math.round(value * 100))

const context = (existing: ExistingSale[] = []): SaleContext => ({
  currency: "try",
  product_title: "Şef bıçağı",
  variants: [
    { id: "variant_a", title: "20 cm", base: lira(100) },
    { id: "variant_b", title: "25 cm", base: lira(33.33) },
    { id: "variant_none", title: "Fiyatsız", base: null },
  ],
  existing: new Map(
    existing.map((sale) => [
      sale.variant_id,
      existing.filter((s) => s.variant_id === sale.variant_id),
    ])
  ),
  now: NOW,
})

const input = (over: Partial<VariantSaleInput>): VariantSaleInput => ({
  product_id: "prod_1",
  set: [],
  clear: [],
  ...over,
})

const sale = (over: Partial<ExistingSale> = {}): ExistingSale => ({
  price_list_id: "plist_old",
  variant_id: "variant_a",
  amount: lira(80),
  starts_at: null,
  ends_at: null,
  ...over,
})

const codeOf = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return (error as Error).message
  }
  return null
}

/** adr/0086: a variant's sale price as a `sale` price list of its own. */
describe("planning variants' sale prices", () => {
  it("makes one active sale list per variant, marked as its, in the shop's currency", () => {
    const plan = planVariantSales(
      input({
        set: [
          {
            variant_id: "variant_a",
            amount: lira(79.9),
            starts_at: "2026-12-01T00:00:00+03:00",
            ends_at: "2026-12-07T23:59:59+03:00",
          },
        ],
      }),
      context()
    )
    expect(plan).toEqual({
      create: [
        {
          title: "Şef bıçağı · 20 cm",
          description: "",
          status: "active",
          starts_at: "2026-11-30T21:00:00.000Z",
          ends_at: "2026-12-07T20:59:59.000Z",
          metadata: { managed_by: "variant_sale", variant_id: "variant_a" },
          prices: [{ variant_id: "variant_a", currency_code: "try", amount: 79.9 }],
        },
      ],
      remove: [],
      unchanged: [],
    })
    expect(isVariantSaleMeta(plan.create[0]?.metadata)).toBe(true)
  })

  it("works a percentage out from the variant's own price, half-up to the kuruş", () => {
    const plan = planVariantSales(
      input({ set: [{ variant_id: "variant_b", rate_bps: 1500 }] }),
      context()
    )
    // 33.33 less 15% is 28.3305
    expect(plan.create[0]?.prices[0]?.amount).toBe(28.33)
  })

  it("replaces a changed sale (new list first, old one removed) and leaves an unchanged one", () => {
    const changed = planVariantSales(
      input({ set: [{ variant_id: "variant_a", amount: lira(70) }] }),
      context([sale()])
    )
    expect(changed.create).toHaveLength(1)
    expect(changed.remove).toEqual(["plist_old"])

    const same = planVariantSales(
      input({ set: [{ variant_id: "variant_a", amount: lira(80) }] }),
      context([sale()])
    )
    expect(same).toEqual({ create: [], remove: [], unchanged: ["variant_a"] })
  })

  it("clears a variant's every sale list", () => {
    const plan = planVariantSales(
      input({ clear: ["variant_a"] }),
      context([sale(), sale({ price_list_id: "plist_two" })])
    )
    expect(plan).toEqual({ create: [], remove: ["plist_old", "plist_two"], unchanged: [] })
  })

  it.each([
    ["equal to the regular price", { amount: lira(100) }, "variant_sale.not_below_regular"],
    ["above the regular price", { amount: lira(120) }, "variant_sale.not_below_regular"],
    ["zero", { amount: lira(0) }, "variant_sale.amount"],
    [
      "both a price and a rate",
      { amount: lira(50), rate_bps: 1000 },
      "variant_sale.amount_or_rate",
    ],
    ["neither", {}, "variant_sale.amount_or_rate"],
    ["a rate of 100%", { rate_bps: 10_000 }, "price_lists.rate"],
    [
      "an end before its start",
      { amount: lira(50), starts_at: "2026-12-02T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" },
      "variant_sale.dates_order",
    ],
    [
      "an end already past",
      { amount: lira(50), ends_at: "2026-11-01T00:00:00Z" },
      "variant_sale.ended",
    ],
    ["an unreadable date", { amount: lira(50), starts_at: "yarın" }, "variant_sale.date"],
  ])("refuses a sale %s", (_name, entry, code) => {
    expect(
      codeOf(() =>
        planVariantSales(input({ set: [{ variant_id: "variant_a", ...entry }] }), context())
      )
    ).toBe(code)
  })

  it("refuses another product's variant, one with no regular price and a variant named twice", () => {
    const one = (variant_id: string) => [{ variant_id, amount: lira(10) }]
    expect(codeOf(() => planVariantSales(input({ set: one("variant_x") }), context()))).toBe(
      "variant_sale.variant_unknown"
    )
    expect(codeOf(() => planVariantSales(input({ clear: ["variant_x"] }), context()))).toBe(
      "variant_sale.variant_unknown"
    )
    expect(codeOf(() => planVariantSales(input({ set: one("variant_none") }), context()))).toBe(
      "variant_sale.no_regular_price"
    )
    expect(
      codeOf(() =>
        planVariantSales(input({ set: one("variant_a"), clear: ["variant_a"] }), context())
      )
    ).toBe("variant_sale.duplicate")
  })
})

describe("the sale the panel shows", () => {
  it("shows the running sale, else the next one, never an ended one", () => {
    const ended = sale({ price_list_id: "ended", ends_at: "2026-11-20T00:00:00.000Z" })
    const next = sale({ price_list_id: "next", starts_at: "2026-12-01T00:00:00.000Z" })
    const running = sale({ price_list_id: "running", starts_at: "2026-11-01T00:00:00.000Z" })
    expect(shownSale([ended, next, running], NOW)).toMatchObject({
      price_list_id: "running",
      running: true,
    })
    expect(shownSale([ended, next], NOW)).toMatchObject({ price_list_id: "next", running: false })
    expect(shownSale([ended], NOW)).toBeNull()
  })

  it("reads only our own mark", () => {
    expect(isVariantSaleMeta({ managed_by: "wholesale" })).toBe(false)
    expect(isVariantSaleMeta(null)).toBe(false)
  })
})
