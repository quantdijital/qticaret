import { asInt, marks, rows } from "./sql"
import type { Executor } from "./sql"

/**
 * Cancelled departures whose money staff give back by hand (refund
 * safety follow-up of adr/0076): read by the reconcile's bell sweep and
 * by a cash-on-delivery capture on an order one of whose departures was
 * cancelled.
 */

/** A cancelled departure of an order and how its cancel gave the money back. */
export interface CancelledUse {
  use_id: string
  order_id: string
  slot_id: string
  /** `CANCEL_REFUNDS`, or null: cancelled before the way was kept. */
  cancel_refund: string | null
}

const cancelledUseOf = (row: Record<string, unknown>): CancelledUse => ({
  use_id: String(row["use_id"]),
  order_id: String(row["order_id"]),
  slot_id: String(row["slot_id"]),
  cancel_refund: typeof row["cancel_refund"] === "string" ? row["cancel_refund"] : null,
})

/**
 * Cancelled departures changed in the last `days` (cancelled, or marked
 * owed by hand later) whose refund may be owed by hand, the latest
 * first: kept as left to staff, or, cancelled before the
 * way was kept, on a departure the shop cancelled (always in full). The
 * caller checks the ledger and the bell; nothing here is written.
 */
export async function cancelledUsesByHand(
  manager: Executor,
  days: number,
  limit: number
): Promise<CancelledUse[]> {
  const found = await rows(
    manager,
    `SELECT u.id AS use_id, b.order_id, u.slot_id, u.cancel_refund
       FROM booking_slot_use u
       JOIN booking b ON b.id = u.booking_id AND b.deleted_at IS NULL
       JOIN booking_slot s ON s.id = u.slot_id
      WHERE u.cancelled_at IS NOT NULL AND u.deleted_at IS NULL
        AND u.updated_at > now() - make_interval(days => ?)
        AND (u.cancel_refund IN ('offline', 'credit', 'exceeds')
             OR (u.cancel_refund IS NULL AND s.status = 'cancelled'))
      ORDER BY u.cancelled_at DESC, u.id
      LIMIT ?`,
    [asInt(days), asInt(limit)]
  )
  return found.map(cancelledUseOf)
}

/** An order's cancelled departures (its use rows cancelled, or its whole booking). */
export async function cancelledUsesOfOrder(
  manager: Executor,
  orderId: string
): Promise<CancelledUse[]> {
  const found = await rows(
    manager,
    `SELECT u.id AS use_id, b.order_id, u.slot_id, u.cancel_refund
       FROM booking b JOIN booking_slot_use u ON u.booking_id = b.id AND u.deleted_at IS NULL
      WHERE b.order_id = ? AND b.deleted_at IS NULL
        AND (u.cancelled_at IS NOT NULL OR b.status = 'cancelled')
      ORDER BY u.slot_id`,
    [orderId]
  )
  return found.map(cancelledUseOf)
}

/**
 * Cancelled departures marked as owed back by hand (`offline`): money for
 * them is being taken by hand after they were cancelled (a cash on
 * delivery collected). A departure whose refund was sent is left as it
 * is. How many rows changed.
 */
export async function markUsesOwedByHand(
  manager: Executor,
  useIds: readonly string[]
): Promise<number> {
  if (useIds.length === 0) {
    return 0
  }
  const changed = await rows(
    manager,
    `UPDATE booking_slot_use SET cancel_refund = 'offline', updated_at = now()
      WHERE id IN (${marks(useIds.length)}) AND deleted_at IS NULL
        AND (cancel_refund IS NULL OR cancel_refund = 'none')
     RETURNING id`,
    [...useIds]
  )
  return changed.length
}
