import { rows } from "./sql"
import type { Executor } from "./sql"

/**
 * What a booking's messages need written (adr/0076 Ek D7b): the voucher's
 * code and the reminder's mark. Raw SQL, every value bound.
 */

/**
 * The booking's voucher code, made now if it has none: the first writer
 * wins, so two reads at once agree. Null for no such booking. Two
 * bookings drawing the same code (2^-80 a pair) is left to the unique
 * index: the call fails and the next read draws again.
 */
export async function ensureVoucher(
  manager: Executor,
  bookingId: string,
  newCode: () => string
): Promise<string | null> {
  await manager.execute(
    `UPDATE booking SET voucher_code = ?, updated_at = now()
      WHERE id = ? AND voucher_code IS NULL AND deleted_at IS NULL`,
    [newCode(), bookingId]
  )
  const [row] = await rows(
    manager,
    `SELECT voucher_code FROM booking WHERE id = ? AND deleted_at IS NULL`,
    [bookingId]
  )
  const code = row?.["voucher_code"]
  return typeof code === "string" ? code : null
}

/** The booking a code belongs to (already normalized), or null. */
export async function bookingByVoucher(
  manager: Executor,
  code: string
): Promise<{ id: string; order_id: string; status: string } | null> {
  const [row] = await rows(
    manager,
    `SELECT id, order_id, status FROM booking WHERE voucher_code = ? AND deleted_at IS NULL`,
    [code]
  )
  return row
    ? { id: String(row["id"]), order_id: String(row["order_id"]), status: String(row["status"]) }
    : null
}

/**
 * Departures whose reminder is due at `now`: live, on a confirmed booking
 * and a departure not cancelled, not reminded yet, starting within the
 * product's `reminder_days` (0: never) and booked before that window
 * opened (one booked inside it has just had its confirmation). Soonest
 * first, `limit` at most.
 */
export const DUE_REMINDERS = `SELECT u.id
   FROM booking_slot_use u
   JOIN booking b ON b.id = u.booking_id AND b.deleted_at IS NULL
   JOIN booking_slot s ON s.id = u.slot_id AND s.deleted_at IS NULL
   JOIN bookable k ON k.id = s.bookable_id AND k.deleted_at IS NULL
  WHERE u.deleted_at IS NULL
    AND u.cancelled_at IS NULL
    AND u.reminded_at IS NULL
    AND b.status = 'confirmed'
    AND s.status <> 'cancelled'
    AND k.reminder_days > 0
    AND s.starts_at > ?
    AND s.starts_at <= ?::timestamptz + make_interval(days => k.reminder_days)
    AND b.created_at < s.starts_at - make_interval(days => k.reminder_days)
  ORDER BY s.starts_at, u.id
  LIMIT ?`

export async function dueReminders(manager: Executor, now: Date, limit: number): Promise<string[]> {
  const found = await rows(manager, DUE_REMINDERS, [now, now, limit])
  return found.map((row) => String(row["id"]))
}

/** The departure's reminder marked sent; whether this call marked it. */
export async function markReminded(manager: Executor, useId: string): Promise<boolean> {
  const marked = await rows(
    manager,
    `UPDATE booking_slot_use SET reminded_at = now(), updated_at = now()
      WHERE id = ? AND reminded_at IS NULL AND deleted_at IS NULL RETURNING id`,
    [useId]
  )
  return marked.length > 0
}
