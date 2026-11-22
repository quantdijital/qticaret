import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
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
 * (its number for the link), the places, the state; newest first. No
 * person's details: travelers come with D6, behind their own reading.
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
  return bookings.map((booking) => ({
    id: booking.id,
    order_id: booking.order_id,
    display_id: numberOf.get(booking.order_id) ?? null,
    units: unitsOf.get(booking.id) ?? 0,
    status: booking.status,
    created_at: new Date(booking.created_at).toISOString(),
  }))
}
