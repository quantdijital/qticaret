import "server-only"
import type { TravelerLevel } from "@qticaret/ui"
import { isStoreApiError } from "../store-api/errors"
import { storeGet, storePost } from "../store-api/server"

/**
 * A cart's travelers on the Store API (adr/0076 §7, Ek D6b): what each
 * dated line's departure asks and what was entered. An ID or passport
 * number goes to the backend once, as typed, and only ever comes back
 * masked ("***1234").
 */

export interface StoreTravelerNeed {
  slot_id: string
  level: TravelerLevel
  /** Σ quantity × pax on the departure: one traveler each. */
  count: number
  starts_at: string | null
}

export interface StoreTraveler {
  slot_id: string
  position: number
  first_name: string
  last_name: string
  birth_date: string | null
  nationality: string | null
  document_masked: string | null
}

/** `GET /store/carts/:id/travelers`. */
export interface StoreCartTravelers {
  needs: StoreTravelerNeed[]
  travelers: StoreTraveler[]
  complete: boolean
}

/** One traveler as the form sends it; a field the departure does not ask is left out. */
export interface TravelerInput {
  slot_id: string
  first_name: string
  last_name: string
  birth_date?: string
  document_no?: string
  nationality?: string
}

/**
 * What the cart's departures ask of their travelers; null when it cannot
 * be read (dated sales off, a backend hiccup): no travelers step is drawn
 * and the payment's start refuses itself while they are missing.
 */
export async function cartTravelers(cartId: string): Promise<StoreCartTravelers | null> {
  try {
    return await storeGet<StoreCartTravelers>(
      `/store/carts/${encodeURIComponent(cartId)}/travelers`
    )
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/** The cart's travelers replaced by these (the backend checks them against what is asked). */
export async function saveCartTravelers(
  cartId: string,
  travelers: readonly TravelerInput[]
): Promise<void> {
  await storePost(`/store/carts/${encodeURIComponent(cartId)}/travelers`, { travelers })
}

/** Whether the cart asks for travelers at all (a departure with a level and places). */
export const asksTravelers = (data: StoreCartTravelers | null): data is StoreCartTravelers =>
  data !== null && data.needs.length > 0
