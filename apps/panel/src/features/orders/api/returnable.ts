import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import { KEY, useReturnMutation } from "./returns"
import type { ReturnReason, WithdrawalExclusion, WithdrawalWarning } from "./returns"

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
    /**
     * This line's own window: a shipped line's from its parcels, a gift
     * line's from its cards; the order's `window_open` when not given.
     */
    window_open?: boolean
    window_closed_reason?: "not_yet" | "expired" | "order_canceled" | null
    /** Outside the right of withdrawal (F13.4): back only as faulty, never exchanged. */
    withdrawal_excluded: boolean
    withdrawal_excluded_reason: WithdrawalExclusion | null
    /** A sealed good: asked back, refused at receipt if opened (MSY md. 15/1-ç). */
    withdrawal_warning: WithdrawalWarning | null
    /** A gift card line: asked on its own, as money back; its cards voided, nothing sent back. */
    gift_card: boolean
    /** The product's other variants, for an exchange. */
    variants: { id: string; title: string | null }[]
  }[]
}

/**
 * A line staff may ask back for the shopper now: a unit left, inside its
 * own window (a line outside it would be refused `returns.window_closed`
 * while another line's window keeps the order's open).
 */
export const lineOpen = (line: Returnable["lines"][number]): boolean =>
  line.returnable > 0 && line.window_open !== false

export const returnableQuery = (orderId: string) =>
  queryOptions({
    queryKey: [...KEY, "returnable", orderId],
    queryFn: () =>
      sdk.client.fetch<Returnable>(`/admin/orders/${encodeURIComponent(orderId)}/returnable`),
  })

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
