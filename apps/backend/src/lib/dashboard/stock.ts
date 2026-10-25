/**
 * The stock list's views (adr/0022): every item, the ones running low and
 * the sold-out ones. Sellable stock is what is on the shelves less what is
 * held for orders, across locations; low means at or under the threshold
 * (one for all items until F3 T8 gives each its own, adr/0020).
 */

export const STOCK_VIEWS = ["all", "low", "out"] as const
export type StockView = (typeof STOCK_VIEWS)[number]

export interface StockRow {
  id: string
  location_levels?:
    ({ stocked_quantity?: number | null; reserved_quantity?: number | null } | null)[] | null
}

export function sellable(row: StockRow): number {
  return (row.location_levels ?? []).reduce(
    (sum, level) => sum + (level?.stocked_quantity ?? 0) - (level?.reserved_quantity ?? 0),
    0
  )
}

// "low" holds the sold-out ones too, as the dashboard's count does
const inView = (view: StockView, available: number, threshold: number): boolean =>
  view === "all" || (view === "low" ? available <= threshold : available <= 0)

export interface StockSlice {
  page: { id: string; available: number }[]
  count: number
  counts: Record<StockView, number>
}

/**
 * Sorts items into views and cuts the asked page. "low" and "out" put the
 * emptiest first; "all" keeps the order given.
 */
export function stockSlice(
  rows: StockRow[],
  view: StockView,
  offset: number,
  limit: number,
  threshold: number
): StockSlice {
  const counts: Record<StockView, number> = { all: 0, low: 0, out: 0 }
  const matching: StockSlice["page"] = []
  for (const row of rows) {
    const available = sellable(row)
    for (const key of STOCK_VIEWS) {
      counts[key] += inView(key, available, threshold) ? 1 : 0
    }
    if (inView(view, available, threshold)) {
      matching.push({ id: row.id, available })
    }
  }
  if (view !== "all") {
    matching.sort((a, b) => a.available - b.available)
  }
  return { page: matching.slice(offset, offset + limit), count: matching.length, counts }
}
