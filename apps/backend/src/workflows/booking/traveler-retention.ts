import type { MedusaContainer } from "@medusajs/framework/types"
import { UNBOOKED_TRAVELER_DAYS } from "../../lib/booking/travelers"
import { cutoffOf } from "../../lib/compliance/retention"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { orderedCarts } from "../compliance/retention"

type Container = Pick<MedusaContainer, "resolve">

const BATCH = 500
// A night's work at most; a larger backlog is finished the nights after
const MAX_BATCHES = 40

/**
 * Travelers deleted for good (adr/0076 §7, docs/kvkk-envanter.md), part of
 * the nightly `compliance-retention`: (a) every one whose departure's
 * period has passed (`purge_after`, the service's date + 180 days); (b) a
 * cart's that never became an order, two days on (a hold lives at most
 * 135 minutes). A cart that did become an order keeps its travelers until
 * (a), even when they never reached its booking.
 */
export async function forgetTravelers(
  container: Container,
  now: Date
): Promise<{ past: number; unbooked: number }> {
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  let past = 0
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const rows = await service.listBookingTravelers(
      { purge_after: { $lt: now } },
      { select: ["id"], take: BATCH }
    )
    if (rows.length > 0) {
      await service.deleteBookingTravelers(rows.map((row) => row.id))
      past += rows.length
    }
    if (rows.length < BATCH) {
      break
    }
  }
  const cutoff = cutoffOf(UNBOOKED_TRAVELER_DAYS, now)
  let unbooked = 0
  let after = ""
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    // By id: an ordered cart's rows are stepped over, never read again this night
    const rows = await service.listBookingTravelers(
      { booking_id: null, created_at: { $lt: cutoff }, id: { $gt: after } },
      { select: ["id", "cart_id"], take: BATCH, order: { id: "ASC" } }
    )
    const ordered = await orderedCarts(container, [...new Set(rows.map((row) => row.cart_id))])
    const due = rows.filter((row) => !ordered.has(row.cart_id))
    if (due.length > 0) {
      await service.deleteBookingTravelers(due.map((row) => row.id))
      unbooked += due.length
    }
    after = rows.at(-1)?.id ?? after
    if (rows.length < BATCH) {
      break
    }
  }
  return { past, unbooked }
}

/**
 * A person's erasure (adr/0041 §6): the travelers entered on their carts,
 * booked or not. Who travelled is the buyer's data as much as the
 * travelers'; the order's lines and amounts stay for the books.
 */
export async function eraseCartTravelers(container: Container, cartIds: string[]) {
  if (cartIds.length === 0) {
    return 0
  }
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const rows = await service.listBookingTravelers({ cart_id: cartIds }, { select: ["id"] })
  if (rows.length > 0) {
    await service.deleteBookingTravelers(rows.map((row) => row.id))
  }
  return rows.length
}
