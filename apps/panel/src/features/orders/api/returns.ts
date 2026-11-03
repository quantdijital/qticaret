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

/**
 * Why a line is outside the right of withdrawal: the product's mark
 * (F13.6), an add-on made to the buyer's wish (adr/0052 §8), or a gift
 * card line one of whose cards was spent (adr/0025 Ek 2026-11-03).
 */
export type WithdrawalExclusion = "product" | "personal_addon" | "gift_card_used"

/**
 * A line a request asks back, marked when it is outside the right of
 * withdrawal as `/admin/orders/:id/returnable` marks it, read when the
 * request is: back only as faulty or wrong; a spent gift card not at all.
 */
export interface ReturnRequestLine extends ReturnLine {
  withdrawal_excluded: boolean
  withdrawal_excluded_reason: WithdrawalExclusion | null
  /** A gift card line; the queue's list does not say it yet, the order's lines do. */
  gift_card?: boolean
}

/** A line asked back for another variant (adr/0032 §6), named for staff. */
export interface ExchangeLine extends ReturnLine {
  variant_id: string
  title: string | null
}

export interface ReturnRequest {
  id: string
  order_id: string
  order_display_id: number | null
  /** A return gives money back; an exchange sends another variant. */
  kind: "return" | "exchange"
  exchange_items: ExchangeLine[] | null
  /** Exact lira: positive when the shopper owes, negative when the shop does. */
  difference: string | null
  status: ReturnStatus
  reason: ReturnReason
  note: string | null
  items: ReturnRequestLine[]
  decision_note: string | null
  return_code: string | null
  return_label_file_id: string | null
  received_items: ReturnLine[] | null
  damaged_items: ReturnLine[] | null
  refund_shipping: boolean
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

/** The order's lines by id, to name what is asked back; the metadata tells a gift card line. */
export const returnLinesQuery = (orderId: string) =>
  queryOptions({
    queryKey: [...KEY, "lines", orderId],
    queryFn: async () =>
      (
        await sdk.admin.order.retrieve(orderId, {
          fields: "items.id,items.title,items.variant_title,items.metadata",
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
      // A gift card withdrawal voids cards (adr/0025 Ek 2026-11-03)
      await client.invalidateQueries({ queryKey: ["gift-cards"] })
    },
  })
}

const url = (id: string, action: string) =>
  `/admin/return-requests/${encodeURIComponent(id)}/${action}`

/**
 * Approves a request; for an exchange the shopper owes on, staff say they
 * collected it. A gift card withdrawal is received and refunded at once: a
 * refund that failed comes back as its reason ("refund" tries it again).
 */
export const useApproveReturn = () =>
  useReturnMutation(({ id, collected }: { id: string; collected?: boolean }) =>
    sdk.client.fetch<{ return_request: ReturnRequest; refund_error?: string | null }>(
      url(id, "approve"),
      {
        method: "POST",
        body: collected === undefined ? {} : { difference_collected: collected },
      }
    )
  )

export const useRejectReturn = () =>
  useReturnMutation(({ id, note }: { id: string; note: string }) =>
    sdk.client.fetch(url(id, "reject"), { method: "POST", body: { note } })
  )

export interface ReceiveInput {
  id: string
  /** Back in stock. */
  items: ReturnLine[]
  /** Broken: refunded, not restocked. */
  damaged: ReturnLine[]
  refund_shipping: boolean
}

/** Receives what came back; a refund that failed comes back as its reason. */
export const useReceiveReturn = () =>
  useReturnMutation(({ id, ...body }: ReceiveInput) =>
    sdk.client.fetch<{ refund_error: string | null }>(url(id, "receive"), {
      method: "POST",
      body,
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

/** The reasons a request can give, as the server takes them. */
export const RETURN_REASONS: readonly ReturnReason[] = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "changed_mind",
  "size_issue",
  "other",
]

/** Reasons a product outside the right of withdrawal still comes back for (F13.4). */
export const DEFECT_REASONS: readonly ReturnReason[] = ["damaged", "wrong_item", "not_as_described"]

/** What staff may ask back for the shopper (F12.3), by the shopper's own rules. */
export interface Returnable {
  window_open: boolean
  /** A request is open: one at a time. */
  open_request: boolean
  lines: {
    line_item_id: string
    title: string | null
    variant_title: string | null
    variant_id: string | null
    /** Units left; a gift card line's are its cards, none once one was spent. */
    returnable: number
    /** Outside the right of withdrawal (F13.4): back only as faulty, never exchanged. */
    withdrawal_excluded: boolean
    withdrawal_excluded_reason: WithdrawalExclusion | null
    /** A gift card line: asked on its own, as money back; its cards voided, nothing sent back. */
    gift_card: boolean
    /** The product's other variants, for an exchange. */
    variants: { id: string; title: string | null }[]
  }[]
}

export const returnableQuery = (orderId: string) =>
  queryOptions({
    queryKey: [...KEY, "returnable", orderId],
    queryFn: () =>
      sdk.client.fetch<Returnable>(`/admin/orders/${encodeURIComponent(orderId)}/returnable`),
  })

/** The request's lines outside the right of withdrawal, by id and why, as the request carries them. */
export const excludedLinesOf = (
  request: Pick<ReturnRequest, "items">
): ReadonlyMap<string, WithdrawalExclusion | null> =>
  new Map(
    request.items
      .filter((item) => item.withdrawal_excluded)
      .map((item) => [item.line_item_id, item.withdrawal_excluded_reason])
  )

/** Why the request's first line outside the right of withdrawal is; undefined when none is. */
export const exclusionOf = (
  request: Pick<ReturnRequest, "items">
): WithdrawalExclusion | null | undefined => {
  const line = request.items.find((item) => item.withdrawal_excluded)
  return line ? line.withdrawal_excluded_reason : undefined
}

export interface OpenRequest {
  kind: "return" | "exchange"
  items: { line_item_id: string; quantity: number; variant_id?: string }[]
  reason: ReturnReason
  note?: string
}

/** A request opened for the shopper who called (F12.3); it then waits in the queue like theirs. */
export const useOpenReturnRequest = (orderId: string) =>
  useReturnMutation((body: OpenRequest) =>
    sdk.client.fetch(`/admin/orders/${encodeURIComponent(orderId)}/return-requests`, {
      method: "POST",
      body,
    })
  )
