import { kurus } from "../../money"
import { stockRows, stockTotals } from "../stock"
import type { StockItem, StockMotion } from "../stock"

const NOW = new Date("2026-10-29T09:00:00Z")
const OLD = new Date("2026-01-01T00:00:00Z")

const item = (id: string, over: Partial<StockItem> = {}): StockItem => ({
  item_id: `iitem_${id}`,
  variant_id: `variant_${id}`,
  product_id: "prod_1",
  product_title: "Kupa",
  variant_title: id,
  sku: id.toUpperCase(),
  created_at: OLD,
  on_hand: 10,
  cost: kurus(2500),
  ...over,
})

const motion = (over: Partial<StockMotion> = {}): StockMotion => ({
  sold: new Map(),
  soldLately: new Set(),
  start: new Map(),
  end: new Map(),
  ...over,
})

describe("stock report", () => {
  it("values only what has a cost, and counts the rest apart", () => {
    const rows = stockRows(
      [item("a"), item("b", { cost: null, on_hand: 4 }), item("c", { on_hand: 0 })],
      motion({ soldLately: new Set(["variant_a", "variant_b", "variant_c"]) }),
      { idleDays: 90, now: NOW }
    )

    expect(rows[0]?.value).toBe(25000)
    expect(stockTotals(rows)).toEqual({
      value: "250.00",
      units: 14,
      costed_items: 1,
      uncosted_items: 1,
      uncosted_units: 4,
      idle_items: 0,
      idle_units: 0,
      idle_value: "0.00",
    })
  })

  it("values a fractional shelf to the kuruş, and never fails on a typo's size", () => {
    const rows = stockRows(
      [
        item("half", { on_hand: 0.5, cost: kurus(333) }),
        item("huge", { on_hand: 1_000_000_000, cost: kurus(1_000_000_000) }),
      ],
      motion(),
      { idleDays: 90, now: NOW }
    )

    expect(rows.map((row) => row.value)).toEqual([167, null])
    expect(stockTotals(rows)).toMatchObject({ value: "1.67", costed_items: 1, uncosted_items: 1 })
  })

  it("turns over the period's sales against its average stock", () => {
    const [row] = stockRows(
      [item("a", { on_hand: 6 })],
      motion({
        sold: new Map([["variant_a", 9]]),
        start: new Map([["iitem_a", 12]]),
        end: new Map([["iitem_a", 6]]),
      }),
      { idleDays: 90, now: NOW }
    )
    const [still] = stockRows([item("b", { on_hand: 0 })], motion(), { idleDays: 90, now: NOW })

    expect(row).toMatchObject({ sold: 9, start: 12, end: 6, turnover: 1 })
    // Nothing on the shelf at either end: no turnover to speak of
    expect(still?.turnover).toBeNull()
  })

  it("calls stock idle only when it is old, on the shelf and not sold lately", () => {
    const rows = stockRows(
      [
        item("old"),
        item("sold"),
        item("new", { created_at: new Date("2026-10-01T00:00:00Z") }),
        item("empty", { on_hand: 0 }),
      ],
      motion({ soldLately: new Set(["variant_sold"]) }),
      { idleDays: 90, now: NOW }
    )

    expect(rows.map((row) => row.idle)).toEqual([true, false, false, false])
    expect(stockTotals(rows)).toMatchObject({ idle_items: 1, idle_units: 10, idle_value: "250.00" })
  })
})
