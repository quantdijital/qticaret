import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { maskDocument } from "../../../lib/booking/travelers"
import { BOOKING_MODULE } from "../../../modules/booking"
import type BookingModuleService from "../../../modules/booking/service"

// A departure's bookings; past this, a typo in the capacity, not a departure
const MOST = 1000

interface OrderRow {
  id: string
  display_id: number | null
}

/**
 * A departure's bookings as staff see them (adr/0076 §9, D4): the order
 * (its number for the link), the places, the state, its travelers on
 * this departure (D6, the number masked); newest first. A recorded read
 * (`SENSITIVE_READS`): it names people.
 */
export async function readSlotBookings(scope: MedusaContainer, slotId: string) {
  const service = scope.resolve<BookingModuleService>(BOOKING_MODULE)
  const [slot] = await service.listBookingSlots({ id: slotId }, { take: 1, select: ["id"] })
  if (!slot) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
  }
  const uses = await service.listBookingSlotUses(
    { slot_id: slotId },
    { take: MOST, select: ["booking_id", "units"] }
  )
  if (uses.length === 0) {
    return []
  }
  const unitsOf = new Map(uses.map((use) => [use.booking_id, use.units]))
  const bookings = await service.listBookings(
    { id: [...unitsOf.keys()] },
    {
      take: MOST,
      select: ["id", "order_id", "status", "created_at"],
      order: { created_at: "DESC" },
    }
  )
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { id: [...new Set(bookings.map((booking) => booking.order_id))] },
  })
  const numberOf = new Map((data as OrderRow[]).map((order) => [order.id, order.display_id]))
  const travelersOf = await slotTravelers(service, slotId, [...unitsOf.keys()])
  return bookings.map((booking) => ({
    id: booking.id,
    order_id: booking.order_id,
    display_id: numberOf.get(booking.order_id) ?? null,
    units: unitsOf.get(booking.id) ?? 0,
    status: booking.status,
    created_at: new Date(booking.created_at).toISOString(),
    travelers: travelersOf.get(booking.id) ?? [],
  }))
}

/**
 * The departure's travelers by booking (adr/0076 §7, D6): the name, birth
 * date and nationality; an ID or passport number only as its last four,
 * the full one behind its own audited route. Never the sealed value.
 */
async function slotTravelers(service: BookingModuleService, slotId: string, bookingIds: string[]) {
  const rows = await service.listBookingTravelers(
    { slot_id: slotId, booking_id: bookingIds },
    {
      take: MOST,
      select: [
        "id",
        "booking_id",
        "position",
        "first_name",
        "last_name",
        "birth_date",
        "nationality",
        "document_last4",
      ],
      order: { position: "ASC" },
    }
  )
  const byBooking = new Map<string, ReturnType<typeof shown>[]>()
  for (const row of rows) {
    const bookingId = row.booking_id ?? ""
    byBooking.set(bookingId, [...(byBooking.get(bookingId) ?? []), shown(row)])
  }
  return byBooking
}

const shown = (row: {
  id: string
  position: number
  first_name: string
  last_name: string
  birth_date: string | null
  nationality: string | null
  document_last4: string | null
}) => ({
  id: row.id,
  position: row.position,
  first_name: row.first_name,
  last_name: row.last_name,
  birth_date: row.birth_date,
  nationality: row.nationality,
  document_masked: maskDocument(row.document_last4),
})
