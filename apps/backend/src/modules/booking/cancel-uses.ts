import { ValidationError } from "../../lib/errors"
import { asInt, rows } from "./sql"
import type { Executor } from "./sql"

/**
 * One departure of a booking cancelled (adr/0076 Ek D7a): its use row
 * marked, its places given back (`sold` falls), and the booking itself
 * cancelled once none of its departures is left. The booking row is
 * locked first, so two cancels of the same booking (the shopper's and the
 * shop's departure cancel) run one after the other. Whether it changed: a
 * departure cancelled already, a booking no longer confirmed, or one not
 * on that slot change nothing.
 */
export async function cancelBookingSlot(
  manager: Executor,
  bookingId: string,
  slotId: string
): Promise<boolean> {
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
    `UPDATE booking_slot_use SET cancelled_at = now(), updated_at = now()
      WHERE booking_id = ? AND slot_id = ? AND cancelled_at IS NULL AND deleted_at IS NULL
     RETURNING units`,
    [bookingId, slotId]
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
  booking_id: string
  order_id: string
  slot_id: string
  units: number
}

/** The confirmed bookings' live departures on a slot, oldest first, a page at a time. */
export async function liveUsesOnSlot(
  manager: Executor,
  slotId: string,
  limit: number
): Promise<LiveUse[]> {
  const found = await rows(
    manager,
    `SELECT u.booking_id, b.order_id, u.slot_id, u.units
       FROM booking_slot_use u JOIN booking b ON b.id = u.booking_id
      WHERE u.slot_id = ? AND u.cancelled_at IS NULL AND u.deleted_at IS NULL
        AND b.status = 'confirmed' AND b.deleted_at IS NULL
      ORDER BY u.created_at, u.id
      LIMIT ?`,
    [slotId, limit]
  )
  return found.map((row) => ({
    booking_id: String(row["booking_id"]),
    order_id: String(row["order_id"]),
    slot_id: String(row["slot_id"]),
    units: asInt(row["units"]),
  }))
}

/** An order's live departures (its confirmed bookings' uses not cancelled). */
export async function liveUsesOfOrder(manager: Executor, orderId: string): Promise<LiveUse[]> {
  const found = await rows(
    manager,
    `SELECT u.booking_id, b.order_id, u.slot_id, u.units
       FROM booking_slot_use u JOIN booking b ON b.id = u.booking_id
      WHERE b.order_id = ? AND b.status = 'confirmed' AND b.deleted_at IS NULL
        AND u.cancelled_at IS NULL AND u.deleted_at IS NULL
      ORDER BY u.slot_id`,
    [orderId]
  )
  return found.map((row) => ({
    booking_id: String(row["booking_id"]),
    order_id: String(row["order_id"]),
    slot_id: String(row["slot_id"]),
    units: asInt(row["units"]),
  }))
}

/** Cancelled slots that still have a confirmed booking's live departure (the resume sweep). */
export async function cancelledSlotsWithLiveUses(
  manager: Executor,
  limit: number
): Promise<string[]> {
  const found = await rows(
    manager,
    `SELECT DISTINCT s.id
       FROM booking_slot s
       JOIN booking_slot_use u ON u.slot_id = s.id AND u.cancelled_at IS NULL AND u.deleted_at IS NULL
       JOIN booking b ON b.id = u.booking_id AND b.status = 'confirmed' AND b.deleted_at IS NULL
      WHERE s.status = 'cancelled' AND s.deleted_at IS NULL
      LIMIT ?`,
    [limit]
  )
  return found.map((row) => String(row["id"]))
}
