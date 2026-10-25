import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { PeriodKey } from "@/features/dashboard/period"

export type Lifecycle = "awaiting_payment" | "to_ship" | "shipped" | "delivered" | "canceled"

interface Compared<T> {
  current: T
  previous: T
}

/** `GET /admin/dashboard/overview`: a period against the one before; amounts are decimal strings. */
export interface DashboardOverview {
  period: { key: PeriodKey; granularity: "hour" | "day"; from: string; to: string }
  currency_code: string
  capped: boolean
  totals: {
    sales: Compared<string>
    orders: Compared<number>
    average_order: Compared<string>
    units: Compared<number>
  }
  series: {
    bucket: string
    sales: string
    orders: number
    units: number
    previous_sales: string
    previous_orders: number
  }[]
  statuses: Record<Lifecycle, number>
  top_products: {
    product_id: string
    title: string
    thumbnail: string | null
    units: number
    sales: string
  }[]
  categories: {
    key: string
    name: string | null
    kind: "category" | "uncategorized" | "other"
    sales: string
  }[]
}

export const overviewQuery = (period: PeriodKey) =>
  queryOptions({
    queryKey: ["dashboard", "overview", period],
    queryFn: () =>
      sdk.client.fetch<DashboardOverview>("/admin/dashboard/overview", { query: { period } }),
    staleTime: 60_000,
    // dataviz: refetching keeps the frame, no flash of skeletons
    placeholderData: keepPreviousData,
  })
