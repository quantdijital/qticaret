import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ReportRange } from "@/features/reports/range"
import { sdk } from "@/lib/sdk"

export type StatementProvider = "paytr" | "iyzico"

export interface StatementIssue {
  kind: "missing_at_provider" | "unknown_at_shop" | "amount_mismatch" | "refund_mismatch"
  reference: string
  order_id: string | null
  display_id: number | null
  /** Lira, as each side has it. */
  shop: string
  provider: string
}

export interface StatementCheck {
  provider: StatementProvider
  day: string
  status: "matched" | "mismatched" | "failed"
  matched: number
  sales: number
  error_code: string | null
  checked_at: string
  issues: StatementIssue[]
}

/** `GET /admin/reports/statements` (F11.3): the period's days as the providers' statements agree. */
export interface StatementChecks {
  checks: StatementCheck[]
  providers: { provider: StatementProvider; connected: boolean; test_mode: boolean }[]
}

const KEY = ["reports", "statements"] as const

export const statementChecksQuery = (range: ReportRange) =>
  queryOptions({
    queryKey: [...KEY, range],
    queryFn: () => sdk.client.fetch<StatementChecks>("/admin/reports/statements", { query: range }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

/** Checks a closed day again now: the provider is asked, the day's result replaced. */
export function useRecheckStatement() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: { provider: StatementProvider; day: string }) =>
      (
        await sdk.client.fetch<{ check: StatementCheck }>("/admin/reports/statements", {
          method: "POST",
          body: input,
        })
      ).check,
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}
