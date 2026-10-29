import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { ReportRange } from "@/features/reports/range"
import { sdk } from "@/lib/sdk"

export interface SearchTermRow {
  term: string
  searches: number
  zero_results: number
}

/** `GET /admin/reports/search` (F11.8): storefront searches, counts only. */
export interface SearchReport {
  totals: { searches: number; zero_results: number; terms: number; zero_terms: number }
  top: SearchTermRow[]
  zero: SearchTermRow[]
}

export const searchReportQuery = (range: ReportRange) =>
  queryOptions({
    queryKey: ["reports", "search", range],
    queryFn: () => sdk.client.fetch<SearchReport>("/admin/reports/search", { query: range }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
