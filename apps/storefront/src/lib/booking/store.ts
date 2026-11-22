import "server-only"
import { isNotFound, isStoreApiError } from "../store-api/errors"
import { liraRegion } from "../store-api/requests"
import { storeGet, storePost } from "../store-api/server"
import { intoCart } from "../cart/cart"

/**
 * Dated products on the Store API (adr/0076 §5, §10, Ek D3/D5): a
 * product's departures, a cart's hold and its dated lines, and a
 * departure's places into the cart. Only the departure and the counts are
 * sent; prices and dates are the server's (CLAUDE.md rule 5).
 */

export interface StoreBookingCategory {
  variant_id: string
  title: string | null
  pax: number
  min_age: number | null
  max_age: number | null
}

export interface StoreBookingSlot {
  id: string
  starts_at: string
  ends_at: string | null
  status: "open" | "closed"
  available: number
  /** In the currency's major unit (lira), worked out on the server. */
  prices: { variant_id: string; amount: number }[]
}

/** `GET /store/products/:id/booking`. */
export interface StoreProductBooking {
  cutoff_hours: number
  hold_minutes: number
  max_units_per_cart: number
  timezone: string
  currency_code: string
  categories: StoreBookingCategory[]
  slots: StoreBookingSlot[]
}

/** `GET /store/carts/:id/bookings`: the live hold and the dated lines. */
export interface StoreCartBooking {
  hold: { expires_at: string } | null
  lines: {
    id: string
    variant_id: string | null
    slot_id: string
    starts_at: string
    held: boolean
  }[]
  shipping_method_stale: boolean
}

/**
 * A dated product's departures and prices in the visitor's region (the
 * lira region, as every price on the page); null while the shop has dated
 * sales off (the route answers 404 then, as for another product) or the
 * read fails: the page stays up, offering no departure. Fresh each time:
 * places change by the minute.
 */
export async function productBooking(productId: string): Promise<StoreProductBooking | null> {
  const { id: region_id } = await liraRegion()
  try {
    const { booking } = await storeGet<{ booking: StoreProductBooking }>(
      `/store/products/${encodeURIComponent(productId)}/booking`,
      { region_id }
    )
    return booking
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/**
 * The cart's hold and dated lines, for the countdown; null when it cannot
 * be read (dated sales off, a backend hiccup): the cart shows its lines
 * as they are and the payment checks the hold itself.
 */
export async function cartBooking(cartId: string): Promise<StoreCartBooking | null> {
  try {
    return await storeGet<StoreCartBooking>(`/store/carts/${encodeURIComponent(cartId)}/bookings`)
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/**
 * A booking route's refusal that is not "this cart is gone": dated sales
 * off (a bare 404) or the departure unknown. Kept apart so the cart is not
 * forgotten and opened anew for it.
 */
export class BookingRefused extends Error {
  override readonly name = "BookingRefused"

  constructor(readonly key: string) {
    super(`booking refused: ${key}`)
  }
}

/**
 * A departure's places into the shopper's cart (a new cart when there is
 * none or it is gone), its lines in that departure replaced by these.
 */
export async function bookIntoCart(
  slotId: string,
  items: readonly { variant_id: string; quantity: number }[]
): Promise<void> {
  await intoCart(async (cartId) => {
    try {
      await storePost(`/store/carts/${encodeURIComponent(cartId)}/bookings`, {
        slot_id: slotId,
        items,
      })
    } catch (error) {
      if (isNotFound(error) && isStoreApiError(error) && error.messageKey !== "cart.unknown") {
        throw new BookingRefused(error.messageKey ?? "booking.unavailable")
      }
      throw error
    }
  })
}
