import { ValidationError } from "../../lib/errors"
import { CANCEL_REFUNDS } from "./models/booking"
import type { CancelRefundWay } from "./models/booking"
import { asInt, rows } from "./sql"
import type { Executor } from "./sql"

/**
 * One departure of a booking cancelled (adr/0076 Ek D7a): its use row
 * marked, its places given back (`sold` falls), and the booking itself
 * cancelled once none of its departures is left. The booking row is
 * locked first, so two cancels of the same booking (the shopper's and the
 * shop's departure cancel) run one after the other. Whether it changed: a
 * departure cancelled already, a booking no longer confirmed, or one not
 * on that slot change nothing. `refund`: how the money went back, kept
 * on the use row in the same statement (a cancel asked again reads it).
 */
export async function cancelBookingSlot(
  manager: Executor,
  bookingId: string,
  slotId: string,
  refund: CancelRefundWay | null = null
): Promise<boolean> {
  if (refund !== null && !CANCEL_REFUNDS.includes(refund)) {
    throw new ValidationError("booking.cancel_refund_invalid", { field: "cancel_refund" })
  }
  const [booking] = await rows(
    manager,
    `SELECT id, status FROM booking WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
    [bookingId]
  )
  if (!booking) {
    throw new ValidationError("booking.unknown", { field: "booking_id" })
  }
  if (booking["status"] !== "confirmed") {
    return false
  }
  const [use] = await rows(
    manager,
    `UPDATE booking_slot_use SET cancelled_at = now(), cancel_refund = ?, updated_at = now()
      WHERE booking_id = ? AND slot_id = ? AND cancelled_at IS NULL AND deleted_at IS NULL
     RETURNING units`,
    [refund, bookingId, slotId]
  )
  if (!use) {
    return false
  }
  await manager.execute(
    `UPDATE booking_slot SET sold = sold - ?, updated_at = now() WHERE id = ?`,
    [asInt(use["units"]), slotId]
  )
  const [left] = await rows(
    manager,
    `SELECT count(*)::int AS live FROM booking_slot_use
      WHERE booking_id = ? AND cancelled_at IS NULL AND deleted_at IS NULL`,
    [bookingId]
  )
  if (asInt(left?.["live"]) === 0) {
    await manager.execute(
      `UPDATE booking SET status = 'cancelled', updated_at = now() WHERE id = ?`,
      [bookingId]
    )
  }
  return true
}

/** A live departure of a confirmed booking: what a cancel acts on. */
export interface LiveUse {
  /** The use row: the refund's reference is made from it. */
  use_id: string
  booking_id: string
  order_id: string
  slot_id: string
  units: number
  /** The cancellation terms copied at confirmation (`{ timezone, tiers }`), null before O5. */
  cancellation: unknown
}

const USE_COLUMNS = `u.id AS use_id, u.booking_id, b.order_id, u.slot_id, u.units, u.cancellation`

const liveUseOf = (row: Record<string, unknown>): LiveUse => ({
  use_id: String(row["use_id"]),
  booking_id: String(row["booking_id"]),
  order_id: String(row["order_id"]),
  slot_id: String(row["slot_id"]),
  units: asInt(row["units"]),
  cancellation:
    typeof row["cancellation"] === "string"
      ? (JSON.parse(row["cancellation"]) as unknown)
      : (row["cancellation"] ?? null),
})

/** The confirmed bookings' live departures on a slot, oldest first, a page at a time. */
export async function liveUsesOnSlot(
  manager: Executor,
  slotId: string,
  limit: number
): Promise<LiveUse[]> {
  const found = await rows(
    manager,
    `SELECT ${USE_COLUMNS}
       FROM booking_slot_use u JOIN booking b ON b.id = u.booking_id
      WHERE u.slot_id = ? AND u.cancelled_at IS NULL AND u.deleted_at IS NULL
        AND b.status = 'confirmed' AND b.deleted_at IS NULL
      ORDER BY u.created_at, u.id
      LIMIT ?`,
    [slotId, limit]
  )
  return found.map(liveUseOf)
}

/** An order's live departures (its confirmed bookings' uses not cancelled). */
export async function liveUsesOfOrder(manager: Executor, orderId: string): Promise<LiveUse[]> {
  const found = await rows(
    manager,
    `SELECT ${USE_COLUMNS}
       FROM booking_slot_use u JOIN booking b ON b.id = u.booking_id
      WHERE b.order_id = ? AND b.status = 'confirmed' AND b.deleted_at IS NULL
        AND u.cancelled_at IS NULL AND u.deleted_at IS NULL
      ORDER BY u.slot_id`,
    [orderId]
  )
  return found.map(liveUseOf)
}

/**
 * Cancelled slots that still have a confirmed booking's live departure
 * (the resume sweep), the longest waiting first, in a stable order: the
 * sweep reads more than it works on and passes over slots whose every
 * booking it has given up on for now (review D4).
 */
export async function cancelledSlotsWithLiveUses(
  manager: Executor,
  limit: number
): Promise<string[]> {
  const found = await rows(
    manager,
    `SELECT s.id, s.updated_at
       FROM booking_slot s
      WHERE s.status = 'cancelled' AND s.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM booking_slot_use u
            JOIN booking b ON b.id = u.booking_id AND b.status = 'confirmed' AND b.deleted_at IS NULL
           WHERE u.slot_id = s.id AND u.cancelled_at IS NULL AND u.deleted_at IS NULL)
      ORDER BY s.updated_at, s.id
      LIMIT ?`,
    [limit]
  )
  return found.map((row) => String(row["id"]))
}

/**
 * The carts' holds on a slot given up (review D5): the departure was
 * cancelled, so the places they keep go back (`held` falls) and their
 * checkout refuses (the hold no longer matches its lines, the slot no
 * longer sells). Run in the transaction that marks the slot cancelled,
 * after its row lock. How many places.
 */
export async function releaseSlotHolds(manager: Executor, slotId: string): Promise<number> {
  const freed = await rows(
    manager,
    `DELETE FROM booking_hold_slot WHERE slot_id = ? RETURNING units`,
    [slotId]
  )
  const units = freed.reduce((sum, row) => sum + asInt(row["units"]), 0)
  if (units > 0) {
    await manager.execute(
      `UPDATE booking_slot SET held = GREATEST(held - ?, 0), updated_at = now() WHERE id = ?`,
      [units, slotId]
    )
  }
  return units
}

/**
 * Whether one of the order's departures was cancelled (its use row, or
 * the whole booking): money taken for it now would have nothing to pay
 * for (review O3), so a bank transfer's confirmation or a capture refuses.
 */
export async function orderHasCancelledDeparture(
  manager: Executor,
  orderId: string
): Promise<boolean> {
  const [found] = await rows(
    manager,
    `SELECT 1 AS found
       FROM booking b JOIN booking_slot_use u ON u.booking_id = b.id AND u.deleted_at IS NULL
      WHERE b.order_id = ? AND b.deleted_at IS NULL
        AND (u.cancelled_at IS NOT NULL OR b.status = 'cancelled')
      LIMIT 1`,
    [orderId]
  )
  return Boolean(found)
}
