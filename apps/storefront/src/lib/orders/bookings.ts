import "server-only"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeCall } from "@/lib/store-api/server"

/**
 * One departure of a dated order as `GET /store/orders/:id/bookings`
 * gives it (adr/0076 Ek D7a): what cancelling it now would give back, the
 * backend's sum in lira; the shopper never sends an amount.
 */
export interface OrderDepartureRow {
  slot_id: string
  starts_at: string
  timezone: string
  titles: string[]
  cancelled: boolean
  cancellable: boolean
  /** Why not now, the backend's key. */
  refusal: string | null
  days_before: number | null
  fee_percent: number | null
  paid: string
  refund: string
  refund_within_days: number | null
}

/**
 * How to reach the shop while it takes cancels by phone or e-mail
 * (adr/0076 Ek basit yol): its own note (null: the default) and contacts.
 */
export interface CancelContactRow {
  note: string | null
  phone: string | null
  email: string | null
}

export interface OrderDeparturesRow {
  currency_code: string
  departures: OrderDepartureRow[]
  /** Only while the shop has the shopper's online cancel off. */
  contact?: CancelContactRow
  /** Whether the shop gives vouchers (adr/0076 Ek D7b); left out by an older backend: no link. */
  voucher?: boolean
}

/**
 * The order's departures, read fresh with the page; null for an order
 * without any, while dated products are off, or when the backend will not say.
 */
export async function orderBookings(
  id: string,
  token: string | null
): Promise<OrderDeparturesRow | null> {
  try {
    return await storeCall<OrderDeparturesRow>(
      `/store/orders/${encodeURIComponent(id)}/bookings`,
      token ? { headers: { "x-order-token": token } } : {}
    )
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}
