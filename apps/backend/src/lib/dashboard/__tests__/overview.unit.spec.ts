import { buildOverview } from "../overview"
import type { OverviewOrder } from "../overview"
import { periodWindow } from "../period"

const NOW = new Date("2026-10-26T11:30:00Z")
const window = periodWindow("7d", NOW)

const paid = [{ status: "authorized", amount: 100, captured_amount: 0, refunded_amount: 0 }]
const order = (at: string, total: number, extra: Partial<OverviewOrder> = {}): OverviewOrder => ({
  created_at: at,
  status: "pending",
  currency_code: "try",
  total,
  payment_collections: paid,
  items: [
    {
      product_id: "prod_knife",
      product_title: "Şef Bıçağı",
      thumbnail: null,
      quantity: 2,
      total,
      product: { categories: [{ id: "pcat_kitchen", name: "Mutfak" }] },
    },
  ],
  ...extra,
})

describe("buildOverview", () => {
  const current = [
    order("2026-10-26T08:00:00Z", 100.1),
    order("2026-10-25T08:00:00Z", 200.2),
    order("2026-10-24T08:00:00Z", 999, { status: "canceled" }),
  ]
  const previous = [order("2026-10-18T08:00:00Z", 150)]
  const overview = buildOverview(window, current, previous)

  it("sums sales in kuruş, leaves canceled orders out, and compares with the window before", () => {
    expect(overview.totals).toEqual({
      sales: { current: "300.30", previous: "150.00" },
      orders: { current: 2, previous: 1 },
      average_order: { current: "150.15", previous: "150.00" },
      units: { current: 4, previous: 2 },
    })
  })

  it("puts each order in its day, the previous window aligned day by day", () => {
    expect(overview.series).toHaveLength(7)
    expect(overview.series[6]).toMatchObject({ sales: "100.10", orders: 1, units: 2 })
    expect(overview.series[5]).toMatchObject({ sales: "200.20", orders: 1 })
    // 18 October is the sixth day of the window before (13–19 October)
    expect(overview.series[5]).toMatchObject({ previous_sales: "150.00", previous_orders: 1 })
    expect(overview.series.reduce((sum, row) => sum + row.previous_orders, 0)).toBe(1)
  })

  it("says where the window's orders stand, canceled ones included", () => {
    expect(overview.statuses).toEqual({
      awaiting_payment: 0,
      planned: 0,
      to_ship: 2,
      shipped: 0,
      delivered: 0,
      canceled: 1,
    })
  })

  it("ranks products and categories by sales", () => {
    expect(overview.top_products).toEqual([
      { product_id: "prod_knife", title: "Şef Bıçağı", thumbnail: null, units: 4, sales: "300.30" },
    ])
    expect(overview.categories).toEqual([
      { key: "pcat_kitchen", name: "Mutfak", kind: "category", sales: "300.30" },
    ])
  })

  it("tells delivered and in-transit orders from those still to ship", () => {
    const sent = (delivered: number) => ({
      quantity: 2,
      detail: { fulfilled_quantity: 2, shipped_quantity: 2, delivered_quantity: delivered },
    })
    const shipped = order("2026-10-26T08:00:00Z", 10, { items: [sent(0)] })
    const delivered = order("2026-10-26T08:00:00Z", 10, { items: [sent(2)] })
    const unpaid = order("2026-10-26T08:00:00Z", 10, {
      payment_collections: [{ status: "not_paid", amount: 10 }],
    })

    expect(buildOverview(window, [shipped, delivered, unpaid], []).statuses).toMatchObject({
      shipped: 1,
      delivered: 1,
      awaiting_payment: 1,
      to_ship: 0,
    })
  })
})
