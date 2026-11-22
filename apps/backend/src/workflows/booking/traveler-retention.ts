import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MAX_TRAVELERS, UNBOOKED_TRAVELER_DAYS } from "../../lib/booking/travelers"
import { cutoffOf } from "../../lib/compliance/retention"
import { errorSummary, logger } from "../../lib/logging"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { orderedCarts } from "../compliance/retention"

type Container = Pick<MedusaContainer, "resolve">

const BATCH = 500
// A night's work at most; a larger backlog is finished the nights after
const MAX_BATCHES = 40

/**
 * An abandoned cart's old unbooked travelers deleted, under the cart's
 * lock (the completion holds it from its check of the travelers to the
 * order's link): a cart being completed right now is passed over, never
 * left with an order but no travelers. Checked again inside the lock: a
 * cart that became an order meanwhile keeps them. How many; 0 when the
 * lock is busy (the next night tries again).
 */
async function forgetAbandonedCart(
  container: Container,
  cartId: string,
  cutoff: Date
): Promise<number> {
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  try {
    return await container.resolve(Modules.LOCKING).execute(
      cartId,
      async () => {
        if ((await orderedCarts(container, [cartId])).has(cartId)) {
          return 0
        }
        const rows = await service.listBookingTravelers(
          { cart_id: cartId, booking_id: null, created_at: { $lt: cutoff } },
          { select: ["id"], take: MAX_TRAVELERS }
        )
        if (rows.length > 0) {
          await service.deleteBookingTravelers(rows.map((row) => row.id))
        }
        return rows.length
      },
      { timeout: 1 }
    )
  } catch (error) {
    logger.warn({
      event: "booking.travelers_forget_skipped",
      cart_id: cartId,
      err: errorSummary(error),
    })
    return 0
  }
}

/**
 * Travelers deleted for good (adr/0076 §7, docs/kvkk-envanter.md), part of
 * the nightly `compliance-retention`: (a) every one whose departure's
 * period has passed (`purge_after`, the service's date + 180 days); (b) a
 * cart's that never became an order, two days on (a hold lives at most
 * 135 minutes). A cart that did become an order keeps its travelers until
 * (a); the reconcile job attaches any that missed its booking.
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
    const due = [...new Set(rows.flatMap((row) => (ordered.has(row.cart_id) ? [] : [row.cart_id])))]
    for (const cartId of due) {
      unbooked += await forgetAbandonedCart(container, cartId, cutoff)
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
