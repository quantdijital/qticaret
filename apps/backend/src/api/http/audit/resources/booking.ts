import type { MedusaContainer } from "@medusajs/framework/types"
import { BOOKING_MODULE } from "../../../../modules/booking"
import type BookingModuleService from "../../../../modules/booking/service"
import type { AuditedResource, Snapshot } from "../types"
import { ID } from "../types"

const bookingOf = (scope: unknown) =>
  (scope as MedusaContainer).resolve<BookingModuleService>(BOOKING_MODULE)

/** A product's booking settings, one value a field (JSON ones as text). */
async function bookableSnapshot(scope: unknown, productId: string): Promise<Snapshot> {
  const [row] = await bookingOf(scope).listBookables({ product_id: productId }, { take: 1 })
  if (!row) {
    return {}
  }
  return {
    cutoff_hours: row.cutoff_hours,
    hold_minutes: row.hold_minutes,
    max_units_per_cart: row.max_units_per_cart,
    min_participants: row.min_participants,
    timezone: row.timezone,
    reminder_days: row.reminder_days,
    sale_mode: row.sale_mode,
    traveler_fields: JSON.stringify(row.traveler_fields ?? null),
    cancellation_tiers: JSON.stringify(row.cancellation_tiers ?? null),
    pax_by_variant: JSON.stringify(row.pax_by_variant ?? null),
  }
}

/**
 * Dated products (adr/0076): settings, departures added, a departure's
 * capacity, state, dates and price differences before and after.
 */
export const BOOKING_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/products/:id/bookable",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/bookable$`, "i"),
    resourceType: "bookable",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => bookableSnapshot(scope, params["id"] ?? ""),
  },
  {
    method: "POST",
    route: "POST /admin/products/:id/booking-slots",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/booking-slots$`, "i"),
    resourceType: "booking_slot",
    resourceId: (params) => params["id"] ?? null,
    // The departures after the save show as added; at most the latest hundred
    snapshot: async ({ scope, params }) => {
      const service = bookingOf(scope)
      const [bookable] = await service.listBookables(
        { product_id: params["id"] ?? "" },
        { take: 1 }
      )
      if (!bookable) {
        return {}
      }
      const slots = await service.listBookingSlots(
        { bookable_id: bookable.id },
        { take: 100, select: ["id", "starts_at", "capacity"], order: { created_at: "DESC" } }
      )
      return Object.fromEntries(
        slots.flatMap((slot): [string, unknown][] => [
          [`${slot.id}.starts_at`, new Date(slot.starts_at).toISOString()],
          [`${slot.id}.capacity`, slot.capacity],
        ])
      )
    },
  },
  {
    method: "POST",
    route: "POST /admin/booking-slots/:id",
    pattern: new RegExp(`^/admin/booking-slots/(?<id>${ID})$`, "i"),
    resourceType: "booking_slot",
    resourceId: (params) => params["id"] ?? null,
    snapshot: async ({ scope, params }) => {
      const [slot] = await bookingOf(scope).listBookingSlots(
        { id: params["id"] ?? "" },
        { take: 1 }
      )
      return slot
        ? {
            capacity: slot.capacity,
            status: slot.status,
            starts_at: new Date(slot.starts_at).toISOString(),
            ends_at: slot.ends_at ? new Date(slot.ends_at).toISOString() : null,
            price_adjustments: JSON.stringify(slot.price_adjustments ?? null),
          }
        : {}
    },
  },
  {
    // The shop cancels a departure: its state and places before and after (adr/0076 Ek D7a)
    method: "POST",
    route: "POST /admin/booking-slots/:id/cancel",
    pattern: new RegExp(`^/admin/booking-slots/(?<id>${ID})/cancel$`, "i"),
    resourceType: "booking_slot",
    resourceId: (params) => params["id"] ?? null,
    snapshot: async ({ scope, params }) => {
      const [slot] = await bookingOf(scope).listBookingSlots(
        { id: params["id"] ?? "" },
        { take: 1 }
      )
      return slot ? { status: slot.status, sold: slot.sold } : {}
    },
  },
  {
    // One departure of an order cancelled by staff: the order's live departures before and after
    method: "POST",
    route: "POST /admin/orders/:id/bookings/cancel",
    pattern: new RegExp(`^/admin/orders/(?<id>${ID})/bookings/cancel$`, "i"),
    resourceType: "booking",
    resourceId: (params) => params["id"] ?? null,
    snapshot: async ({ scope, params }) => {
      const uses = await bookingOf(scope).liveUsesOfOrder(params["id"] ?? "")
      return Object.fromEntries(uses.map((use) => [`${use.slot_id}.units`, use.units]))
    },
  },
]
