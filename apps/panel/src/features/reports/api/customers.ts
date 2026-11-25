import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { ReportRange } from "@/features/reports/range"
import { sdk } from "@/lib/sdk"

/** `GET /admin/reports/customers` (R1); amounts are Medusa amount strings in `currency_code`. */
export interface CustomersReport {
  new_customers: { current: number; previous: number; registered: number; guest: number }
  series: { bucket: string; current: number; previous: number }[]
  buyers: number
  returning: number
  returning_rate: number
  spent_per_buyer: string
  top: { customer_id: string; name: string | null; orders: number; spent: string }[]
  period: { granularity: "hour" | "day"; from: string; to: string }
  currency_code: string
  capped: boolean
}

/** New customers, returning buyers and the top spenders over the report's days (a recorded read). */
export const customersReportQuery = (range: ReportRange) =>
  queryOptions({
    queryKey: ["reports", "customers", range],
    queryFn: () => sdk.client.fetch<CustomersReport>("/admin/reports/customers", { query: range }),
    placeholderData: keepPreviousData,
  })
