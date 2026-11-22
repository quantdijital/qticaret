import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** Dated products (adr/0076): sold by departure, each with its own places. */
export const BOOKING_FLAG = "catalog.booking"

/** `range` is reserved and refused by the server (§11); the panel never offers it. */
export type BookingMode = "none" | "departure" | "range"

export const SLOT_STATUSES = ["open", "closed", "cancelled"] as const
export type SlotStatus = (typeof SLOT_STATUSES)[number]

/** What checkout asks of each traveler, each level adding to the one before (adr/0076 §7). */
export const TRAVELER_LEVELS = ["none", "name", "birth_date", "identity", "nationality"] as const
export type TravelerLevel = (typeof TRAVELER_LEVELS)[number]

/** Per variant: how many places a unit takes (an infant 0) and the ages it is for. */
export interface PaxEntry {
  pax: number
  min_age?: number
  max_age?: number
}

/** `GET /admin/products/:id/bookable`: the product's settings (null until made). */
export interface Bookable {
  id: string
  mode: BookingMode
  cutoff_hours: number
  hold_minutes: number
  max_units_per_cart: number
  min_participants: number | null
  pax_by_variant: Record<string, PaxEntry>
  timezone: string
  /** Absent from an older backend: none asked. */
  traveler_fields?: { level: TravelerLevel }
}

export interface BookableAnswer {
  booking_mode: BookingMode
  bookable: Bookable | null
}

/** A departure as staff see it; differences in lira. */
export interface BookingSlot {
  id: string
  starts_at: string
  ends_at: string | null
  status: SlotStatus
  capacity: number
  sold: number
  held: number
  available: number
  price_adjustments: Record<string, number> | null
}

/** A booked traveler on a departure (adr/0076 §7): the number only masked. */
export interface SlotTraveler {
  id: string
  position: number
  first_name: string
  last_name: string
  birth_date: string | null
  nationality: string | null
  /** `***1234`; null when the product asked none. */
  document_masked: string | null
}

/** One booking on a departure: the order, its places, its travelers there. */
export interface SlotBooking {
  id: string
  order_id: string
  display_id: number | null
  units: number
  status: "confirmed" | "cancelled" | "completed"
  created_at: string
  /** Absent from an older backend. */
  travelers?: SlotTraveler[]
}

export interface BookableSettingsInput {
  cutoff_hours?: number
  hold_minutes?: number
  max_units_per_cart?: number
  min_participants?: number | null
  pax_by_variant?: Record<string, PaxEntry>
  traveler_fields?: { level: TravelerLevel }
}

export interface NewSlot {
  /** ISO 8601 with its offset. */
  starts_at: string
  capacity: number
}

export interface SlotChanges {
  capacity?: number
  status?: SlotStatus
  price_adjustments?: Record<string, number> | null
}

/** The most departures the server takes in one save. */
export const SLOTS_PER_SAVE = 100

const productPath = (id: string) => `/admin/products/${encodeURIComponent(id)}`
const BOOKING_KEY = (productId: string) => ["products", "booking", productId] as const

export const bookableQuery = (productId: string) =>
  queryOptions({
    queryKey: [...BOOKING_KEY(productId), "bookable"],
    queryFn: () => sdk.client.fetch<BookableAnswer>(`${productPath(productId)}/bookable`),
  })

/** The departures from today on (the server's order: by start). */
export const slotsQuery = (productId: string) =>
  queryOptions({
    queryKey: [...BOOKING_KEY(productId), "slots"],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const answer = await sdk.client.fetch<{ slots: BookingSlot[] }>(
        `${productPath(productId)}/booking-slots`,
        { query: { from: today.toISOString(), limit: 500 } }
      )
      return answer.slots
    },
  })

export const slotBookingsQuery = (slotId: string) =>
  queryOptions({
    queryKey: ["booking-slots", slotId, "bookings"],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ bookings: SlotBooking[] }>(
          `/admin/booking-slots/${encodeURIComponent(slotId)}/bookings`
        )
      ).bookings,
  })

export function useSaveBookable(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: BookableSettingsInput) =>
      sdk.client.fetch<BookableAnswer>(`${productPath(productId)}/bookable`, {
        method: "POST",
        body,
      }),
    onSuccess: (answer) => {
      client.setQueryData(bookableQuery(productId).queryKey, answer)
    },
  })
}

export function useCreateSlots(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (slots: NewSlot[]) =>
      sdk.client.fetch<{ slots: BookingSlot[] }>(`${productPath(productId)}/booking-slots`, {
        method: "POST",
        body: { slots },
      }),
    onSuccess: async () => {
      // A first departure makes the settings' row too
      await client.invalidateQueries({ queryKey: BOOKING_KEY(productId) })
    },
  })
}

export function useUpdateSlot(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: SlotChanges }) =>
      sdk.client.fetch<{ slot: BookingSlot }>(`/admin/booking-slots/${encodeURIComponent(id)}`, {
        method: "POST",
        body: changes,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: BOOKING_KEY(productId) })
    },
  })
}
/**
 * A booked traveler's full ID or passport number (adr/0076 §7): owner and
 * admin, proved again (428 asks), recorded before it answers.
 */
export function useRevealTravelerDocument() {
  return useMutation({
    mutationFn: (travelerId: string) =>
      withReauth((extra) =>
        sdk.client.fetch<{ id: string; document_no: string | null }>(
          `/admin/booking-travelers/${encodeURIComponent(travelerId)}/reveal`,
          { method: "POST", body: {}, ...extra }
        )
      ),
    // The number is not kept once nothing shows it
    gcTime: 0,
  })
}
