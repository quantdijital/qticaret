import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A cardholder's dispute of an order's payment (F6.7, adr/0030); the amount in kuruş. */
export type ChargebackStatus = "open" | "evidence_submitted" | "won" | "lost"
export type ChargebackReason =
  "not_received" | "unauthorized" | "not_as_described" | "duplicate" | "other"

export interface Chargeback {
  id: string
  order_id: string
  order_display_id: number | null
  provider: string
  provider_reference: string | null
  /** Exact lira, as the other admin money answers. */
  amount: string
  currency_code: string
  reason: ChargebackReason
  status: ChargebackStatus
  due_at: string | null
  note: string | null
  created_at: string
  closed_at: string | null
}

export const CHARGEBACK_STATUSES: readonly ChargebackStatus[] = [
  "open",
  "evidence_submitted",
  "won",
  "lost",
]

export const CHARGEBACK_REASONS: readonly ChargebackReason[] = [
  "not_received",
  "unauthorized",
  "not_as_described",
  "duplicate",
  "other",
]

/** Where each state may go; a closed one goes nowhere (as the server rules). */
export const NEXT_STATUS: Readonly<Record<ChargebackStatus, readonly ChargebackStatus[]>> = {
  open: ["evidence_submitted", "won", "lost"],
  evidence_submitted: ["won", "lost"],
  won: [],
  lost: [],
}

const KEY = ["chargebacks"] as const

export const CHARGEBACK_PAGE_SIZE = 50

export const chargebacksQuery = (filters: {
  status?: ChargebackStatus
  order_id?: string
  page?: number
}) =>
  queryOptions({
    queryKey: [...KEY, filters],
    queryFn: () =>
      sdk.client.fetch<{ chargebacks: Chargeback[]; count: number }>("/admin/chargebacks", {
        query: {
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.order_id ? { order_id: filters.order_id } : {}),
          limit: CHARGEBACK_PAGE_SIZE,
          offset: (filters.page ?? 0) * CHARGEBACK_PAGE_SIZE,
        },
      }),
  })

/** The evidence file, downloaded with the panel's own session (same origin). */
export const evidenceUrl = (id: string): string =>
  `/admin/chargebacks/${encodeURIComponent(id)}/evidence`

function useChargebackMutation<T>(run: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: KEY })
      await client.invalidateQueries({ queryKey: ["orders"] })
    },
  })
}

export interface OpenChargebackBody {
  order_id: string
  /** Lira, as typed; the server checks it against what was paid. */
  amount: number
  reason: ChargebackReason
  provider_reference?: string
  due_at?: string
  note?: string
}

export const useOpenChargeback = () =>
  useChargebackMutation((body: OpenChargebackBody) =>
    sdk.client.fetch("/admin/chargebacks", { method: "POST", body })
  )

export const useMoveChargeback = () =>
  useChargebackMutation(
    ({ id, ...body }: { id: string; status: ChargebackStatus; note?: string }) =>
      sdk.client.fetch(`/admin/chargebacks/${encodeURIComponent(id)}`, { method: "POST", body })
  )
