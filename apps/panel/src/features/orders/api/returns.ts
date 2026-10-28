import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A shopper's return request (F7.9, adr/0032); the refund as exact lira. */
export type ReturnStatus =
  "requested" | "approved" | "rejected" | "received" | "refunded" | "canceled"
export type ReturnReason =
  "damaged" | "wrong_item" | "not_as_described" | "changed_mind" | "size_issue" | "other"

export interface ReturnLine {
  line_item_id: string
  quantity: number
}

export interface ReturnRequest {
  id: string
  order_id: string
  order_display_id: number | null
  status: ReturnStatus
  reason: ReturnReason
  note: string | null
  items: ReturnLine[]
  decision_note: string | null
  return_code: string | null
  return_label_file_id: string | null
  received_items: ReturnLine[] | null
  refund_amount: string | null
  created_at: string
}

export const RETURN_STATUSES: readonly ReturnStatus[] = [
  "requested",
  "approved",
  "received",
  "refunded",
  "rejected",
]

const KEY = ["returns"] as const

export const RETURN_PAGE_SIZE = 50

export const returnRequestsQuery = (filters: {
  status?: ReturnStatus
  order_id?: string
  page?: number
}) =>
  queryOptions({
    queryKey: [...KEY, filters],
    queryFn: () =>
      sdk.client.fetch<{ return_requests: ReturnRequest[]; count: number }>(
        "/admin/return-requests",
        {
          query: {
            ...(filters.status ? { status: filters.status } : {}),
            ...(filters.order_id ? { order_id: filters.order_id } : {}),
            limit: RETURN_PAGE_SIZE,
            offset: (filters.page ?? 0) * RETURN_PAGE_SIZE,
          },
        }
      ),
  })

/** The order's lines by id, to name what is asked back. */
export const returnLinesQuery = (orderId: string) =>
  queryOptions({
    queryKey: [...KEY, "lines", orderId],
    queryFn: async () =>
      (
        await sdk.admin.order.retrieve(orderId, {
          fields: "items.id,items.title,items.variant_title",
        })
      ).order.items,
  })

function useReturnMutation<T, R = unknown>(run: (input: T) => Promise<R>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: KEY })
      await client.invalidateQueries({ queryKey: ["orders"] })
    },
  })
}

const url = (id: string, action: string) =>
  `/admin/return-requests/${encodeURIComponent(id)}/${action}`

export const useApproveReturn = () =>
  useReturnMutation((id: string) =>
    sdk.client.fetch(url(id, "approve"), { method: "POST", body: {} })
  )

export const useRejectReturn = () =>
  useReturnMutation(({ id, note }: { id: string; note: string }) =>
    sdk.client.fetch(url(id, "reject"), { method: "POST", body: { note } })
  )

/** Receives what came back; a refund that failed comes back as its reason. */
export const useReceiveReturn = () =>
  useReturnMutation(({ id, items }: { id: string; items: ReturnLine[] }) =>
    sdk.client.fetch<{ refund_error: string | null }>(url(id, "receive"), {
      method: "POST",
      body: { items },
    })
  )

export const useRetryRefund = () =>
  useReturnMutation((id: string) =>
    sdk.client.fetch(url(id, "refund"), { method: "POST", body: {} })
  )

/** A short-lived link to the return label (a sensitive read on the server). */
export const useReturnLabel = () =>
  useMutation({
    mutationFn: async (id: string) =>
      (await sdk.client.fetch<{ url: string }>(url(id, "label"))).url,
  })
