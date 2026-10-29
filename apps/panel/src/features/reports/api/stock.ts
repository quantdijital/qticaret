import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { ReportRange } from "@/features/reports/range"
import { sdk } from "@/lib/sdk"

export interface StockRow {
  item_id: string
  variant_id: string | null
  product_id: string | null
  product_title: string | null
  variant_title: string | null
  sku: string | null
  on_hand: number
  /** Lira, VAT excluded; null without a unit cost. */
  cost: string | null
  value: string | null
  sold: number
  start: number
  end: number
  turnover: number | null
  idle: boolean
}

/** `GET /admin/reports/stock` (F11.4): value, turnover, idle stock, what has no cost. */
export interface StockReport {
  period: { key: string; from: string; to: string }
  currency_code: string
  capped: boolean
  idle_days: number
  totals: {
    value: string
    units: number
    costed_items: number
    uncosted_items: number
    uncosted_units: number
    idle_items: number
    idle_units: number
    idle_value: string
  }
  value: StockRow[]
  slow: StockRow[]
  idle: StockRow[]
  uncosted: StockRow[]
}

export const stockReportQuery = (range: ReportRange) =>
  queryOptions({
    queryKey: ["reports", "stock", range],
    queryFn: () => sdk.client.fetch<StockReport>("/admin/reports/stock", { query: range }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
