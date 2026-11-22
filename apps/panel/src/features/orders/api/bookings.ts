import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import { useOrderMutation } from "@/features/orders/api/mutation"

/** Staff's choice when cancelling a departure (adr/0076 Ek D7a): the product's tier, or all back. */
export type BookingCancelMode = "tier" | "full"

/** Why a departure's refund is left to staff: taken by hand, credit used, above the payments. */
export type BookingManualRefund = "offline" | "credit" | "exceeds"

/** A departure cancelled: what was sent, what is left to staff, whether the unpaid order went. */
export interface BookingCancelResult {
  cancelled: boolean
  refunded: string
  refund_by_hand: string
  manual: BookingManualRefund | null
  order_cancelled: boolean
}

/**
 * One departure of a dated order with what cancelling it would give back
 * under the asked mode; lira, worked out on the server (never sent back).
 */
export interface OrderDeparture {
  slot_id: string
  starts_at: string
  timezone: string
  titles: string[]
  cancelled: boolean
  cancellable: boolean
  /** Why not now, an error key the server words. */
  refusal: string | null
  days_before: number | null
  /** The share kept; null: the product has no tier (all back is still possible). */
  fee_percent: number | null
  paid: string
  refund: string
  refund_within_days: number | null
  /** Set: the refund is not sent on its own, staff give it back by hand (and why). */
  manual: BookingManualRefund | null
}

export interface OrderDepartures {
  currency_code: string
  departures: OrderDeparture[]
}

const bookingsPath = (orderId: string) => `/admin/orders/${encodeURIComponent(orderId)}/bookings`

/** `GET /admin/orders/:id/bookings?mode=`: 404 when the order holds no booking. */
export const orderBookingsQuery = (orderId: string, mode: BookingCancelMode) =>
  queryOptions({
    queryKey: ["orders", "bookings", orderId, mode],
    queryFn: () => sdk.client.fetch<OrderDepartures>(bookingsPath(orderId), { query: { mode } }),
    // A plain order has none: no retry on its 404
    retry: false,
  })

/** One departure cancelled with its refund: the departure and the mode, never an amount. */
export const useCancelOrderBooking = (orderId: string) =>
  useOrderMutation((input: { slot_id: string; mode: BookingCancelMode }) =>
    sdk.client.fetch<BookingCancelResult>(`${bookingsPath(orderId)}/cancel`, {
      method: "POST",
      body: input,
    })
  )
