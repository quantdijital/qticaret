import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { ReportRange } from "@/features/reports/range"
import { sdk } from "@/lib/sdk"

/** `GET /admin/reports/finance` (F11.3): sales by VAT rate, money by payment method, disputes. */
export interface FinanceReport {
  period: { key: string; from: string; to: string }
  currency_code: string
  capped: boolean
  vat: { rate: number; base: string; tax: string; gross: string }[]
  payments: { method: string; payments: number; captured: string; refunded: string; net: string }[]
  chargebacks: {
    id: string
    order_display_id: number | null
    provider: string
    reason: string
    status: string
    amount: string
    opened_at: string
    due_at: string | null
  }[]
}

export const financeReportQuery = (range: ReportRange) =>
  queryOptions({
    queryKey: ["reports", "finance", range],
    queryFn: () => sdk.client.fetch<FinanceReport>("/admin/reports/finance", { query: range }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
