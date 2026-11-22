import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { DEFAULT_TRAVELER_FIELDS, adjustmentsInLira } from "../../../lib/booking/settings"
import { BOOKING_MODULE } from "../../../modules/booking"
import type BookingModuleService from "../../../modules/booking/service"
import type { SlotAvailability } from "../../../modules/booking/service"
import type { BookableRow } from "../../../workflows/booking/product"

/** A departure as staff see it: places sold, held by live carts, free; differences in lira. */
export const slotView = (slot: SlotAvailability) => ({
  id: slot.id,
  starts_at: slot.starts_at.toISOString(),
  ends_at: slot.ends_at?.toISOString() ?? null,
  status: slot.status,
  capacity: slot.capacity,
  sold: slot.sold,
  held: slot.held,
  available: slot.available,
  price_adjustments: adjustmentsInLira(slot.price_adjustments),
})

const bookableView = (row: BookableRow) => ({
  id: row.id,
  mode: row.mode,
  cutoff_hours: row.cutoff_hours,
  hold_minutes: row.hold_minutes,
  max_units_per_cart: row.max_units_per_cart,
  min_participants: row.min_participants,
  traveler_fields: row.traveler_fields ?? DEFAULT_TRAVELER_FIELDS,
  cancellation_tiers: row.cancellation_tiers ?? [],
  pax_by_variant: row.pax_by_variant ?? {},
  timezone: row.timezone,
})

interface ProductRow {
  id: string
  product_extension?: { booking_mode?: string | null } | null
  bookable?: BookableRow | null
}

/** A product's booking mode and settings (null until made). */
export async function readBookable(scope: MedusaContainer, productId: string) {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "product_extension.booking_mode", "bookable.*"],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  return {
    booking_mode: product.product_extension?.booking_mode ?? "none",
    bookable: product.bookable ? bookableView(product.bookable) : null,
  }
}

/** A product's departures by start, with their places; none before its settings are made. */
export async function readProductSlots(
  scope: MedusaContainer,
  productId: string,
  options: { from?: Date | undefined; limit: number }
) {
  const { bookable } = await readBookable(scope, productId)
  if (!bookable) {
    return []
  }
  const slots = await scope
    .resolve<BookingModuleService>(BOOKING_MODULE)
    .bookableSlots(bookable.id, options)
  return slots.map(slotView)
}

/** Departures by id, with their places, in the order asked. */
export async function readSlots(scope: MedusaContainer, ids: string[]) {
  const slots = await scope.resolve<BookingModuleService>(BOOKING_MODULE).slotAvailability(ids)
  const byId = new Map(slots.map((slot) => [slot.id, slot]))
  return ids.flatMap((id) => {
    const slot = byId.get(id)
    return slot ? [slotView(slot)] : []
  })
}
