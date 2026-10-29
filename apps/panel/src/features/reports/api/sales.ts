import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { DashboardOverview } from "@/features/dashboard/api/overview"
import type { ReportRange } from "@/features/reports/range"
import { sdk } from "@/lib/sdk"

export type TrafficSource =
  | "organic_search"
  | "paid_search"
  | "social"
  | "paid_social"
  | "email"
  | "referral"
  | "direct"
  | "unknown"

/** The sales report's other cuts (F11.2): brands, promotion codes, returns and traffic sources. */
export interface SalesDetails {
  brands: { key: string; name: string | null; sales: string }[]
  promotions: { code: string | null; orders: number; discount: string; sales: string }[]
  returns: {
    orders: number
    returned: number
    exchanged: number
    return_rate: number
    exchange_rate: number
    refunded: string
  }
  sources: { source: TrafficSource; orders: number; sales: string }[]
}

export type SalesReport = DashboardOverview & { details: SalesDetails }

/**
 * `GET /admin/reports/sales`: the dashboard's numbers with every product
 * and category sold, over a preset period or the days asked for (F11.1).
 */
export const salesReportQuery = (range: ReportRange) =>
  queryOptions({
    queryKey: ["reports", "sales", range],
    queryFn: () => sdk.client.fetch<SalesReport>("/admin/reports/sales", { query: range }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
