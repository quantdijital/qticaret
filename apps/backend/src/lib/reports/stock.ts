import { ZERO_KURUS, addKurus, kurus, toMedusaAmount } from "../money"
import type { Kurus } from "../money"

/**
 * The stock report's numbers (F11.4, adr/0039 §4), from the stock items
 * and what moved them. Pure, in kuruş:
 * - value is unit cost × what is on the shelf, only for items with a cost
 *   (an item without one is counted apart, never guessed from its price);
 * - turnover is units sold in the period / the average of its first and
 *   last day's stock;
 * - an item is idle when it is on the shelf, older than the idle days and
 *   not sold in them.
 */

export interface StockItem {
  item_id: string
  variant_id: string | null
  product_id: string | null
  product_title: string | null
  variant_title: string | null
  sku: string | null
  /** When the variant (or the item) was made: a new one is not idle yet. */
  created_at: Date
  /** Units on the shelf now, locations together. */
  on_hand: number
  /** Unit cost, VAT excluded. */
  cost: Kurus | null
}

export interface StockMotion {
  /** Units sold in the period, by variant. */
  sold: ReadonlyMap<string, number>
  /** Variants sold within the idle days. */
  soldLately: ReadonlySet<string>
  /** Units on the shelf at the period's start and end, by item; an item absent did not move. */
  start: ReadonlyMap<string, number>
  end: ReadonlyMap<string, number>
}

const DAY_MS = 24 * 60 * 60 * 1000

const round2 = (value: number) => Math.round(value * 100) / 100

export function stockRows(
  items: readonly StockItem[],
  motion: StockMotion,
  options: { idleDays: number; now: Date }
) {
  const idleSince = options.now.getTime() - options.idleDays * DAY_MS
  return items.map((item) => {
    const shelf = Math.max(item.on_hand, 0)
    const sold = item.variant_id ? (motion.sold.get(item.variant_id) ?? 0) : 0
    const start = motion.start.get(item.item_id) ?? item.on_hand
    const end = motion.end.get(item.item_id) ?? item.on_hand
    const average = (Math.max(start, 0) + Math.max(end, 0)) / 2
    const lately = item.variant_id ? motion.soldLately.has(item.variant_id) : false
    return {
      ...item,
      on_hand: shelf,
      sold,
      start,
      end,
      turnover: average > 0 ? round2(sold / average) : null,
      value: item.cost === null ? null : kurus(item.cost * shelf),
      idle: shelf > 0 && !lately && item.created_at.getTime() < idleSince,
    }
  })
}

export type StockRow = ReturnType<typeof stockRows>[number]

/** The report's totals: value, items and units with and without a cost, idle stock. */
export function stockTotals(rows: readonly StockRow[]) {
  const shelved = rows.filter((row) => row.on_hand > 0)
  const costed = shelved.filter((row) => row.value !== null)
  const uncosted = shelved.filter((row) => row.value === null)
  const idle = shelved.filter((row) => row.idle)
  const value = (list: readonly StockRow[]) =>
    toMedusaAmount(list.reduce((sum, row) => addKurus(sum, row.value ?? ZERO_KURUS), ZERO_KURUS))
  const units = (list: readonly StockRow[]) => list.reduce((sum, row) => sum + row.on_hand, 0)
  return {
    value: value(costed),
    units: units(shelved),
    costed_items: costed.length,
    uncosted_items: uncosted.length,
    uncosted_units: units(uncosted),
    idle_items: idle.length,
    idle_units: units(idle),
    idle_value: value(idle),
  }
}
