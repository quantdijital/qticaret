import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export type AccountingAdapterId = "none" | "fake"

/** `GET /admin/accounting` (F11.5): the program records go to, and how they are going. */
export interface AccountingStatus {
  adapter: AccountingAdapterId
  active: boolean
  adapters: { id: AccountingAdapterId; available: boolean }[]
  counts: { pending: number; synced: number; stopped: number }
  stopped: {
    id: string
    source_type: "sale" | "payment" | "refund"
    source_id: string
    attempts: number
    last_error: string | null
    updated_at: string
  }[]
}

const KEY = ["accounting"] as const

export const accountingStatusQuery = () =>
  queryOptions({
    queryKey: KEY,
    queryFn: () => sdk.client.fetch<AccountingStatus>("/admin/accounting"),
    staleTime: 30_000,
  })

/** Picks the program: the shop's `accounting` settings section. */
export function usePickAccountingAdapter() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (adapter: AccountingAdapterId) =>
      sdk.client.fetch("/admin/platform-settings/accounting", {
        method: "POST",
        body: { adapter },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

/** A stopped record tried again from the start, on the next run. */
export function useRetryAccountingSync() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/accounting/syncs/${encodeURIComponent(id)}/retry`, {
        method: "POST",
        body: {},
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}
