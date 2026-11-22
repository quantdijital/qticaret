import { ValidationError } from "../../lib/errors"
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
  /** Kuruş: the departure's share of cash collected after its cancel (cash on delivery), or null. */
  refund_due: number | null
  cancelled_at: Date | null
  /** The terms copied at confirmation (`{ timezone, tiers }`), null before they were. */
  cancellation: unknown
}

const COLUMNS = `u.id AS use_id, b.order_id, u.slot_id, u.cancel_refund, u.refund_due,
  u.cancelled_at, u.cancellation`

const cancelledUseOf = (row: Record<string, unknown>): CancelledUse => ({
  use_id: String(row["use_id"]),
  order_id: String(row["order_id"]),
  slot_id: String(row["slot_id"]),
  cancel_refund: typeof row["cancel_refund"] === "string" ? row["cancel_refund"] : null,
  refund_due:
    row["refund_due"] === null || row["refund_due"] === undefined ? null : asInt(row["refund_due"]),
  cancelled_at: row["cancelled_at"] ? new Date(row["cancelled_at"] as string | Date) : null,
  cancellation:
    typeof row["cancellation"] === "string"
      ? (JSON.parse(row["cancellation"]) as unknown)
      : (row["cancellation"] ?? null),
})

/**
 * Cancelled departures changed in the last `days` (cancelled, or marked
 * owed by hand later) whose refund may be owed by hand and that the
 * sweep has not settled yet (`bell_checked_at` empty), the longest
 * waiting first: kept as left to staff, or, cancelled before the way was
 * kept, on a departure the shop cancelled (always in full). A row the
 * sweep settles is marked and leaves the query, so a full page never
 * hides the rest (review O3 of #277).
 */
export async function cancelledUsesByHand(
  manager: Executor,
  days: number,
  limit: number
): Promise<CancelledUse[]> {
  const found = await rows(
    manager,
    `SELECT ${COLUMNS}
       FROM booking_slot_use u
       JOIN booking b ON b.id = u.booking_id AND b.deleted_at IS NULL
       JOIN booking_slot s ON s.id = u.slot_id
      WHERE u.cancelled_at IS NOT NULL AND u.deleted_at IS NULL AND u.bell_checked_at IS NULL
        AND u.updated_at > now() - make_interval(days => ?)
        AND (u.cancel_refund IN ('offline', 'credit', 'exceeds')
             OR (u.cancel_refund IS NULL AND s.status = 'cancelled'))
      ORDER BY u.updated_at, u.id
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
    `SELECT ${COLUMNS}
       FROM booking b JOIN booking_slot_use u ON u.booking_id = b.id AND u.deleted_at IS NULL
      WHERE b.order_id = ? AND b.deleted_at IS NULL
        AND (u.cancelled_at IS NOT NULL OR b.status = 'cancelled')
      ORDER BY u.slot_id`,
    [orderId]
  )
  return found.map(cancelledUseOf)
}

/**
 * A cancelled departure marked as owed back by hand (`offline`) with its
 * share of the cash collected (`refund_due`, kuruş): cash on delivery
 * was recorded for the order after the departure was cancelled. The
 * sweep looks at it again (`bell_checked_at` cleared). A departure whose
 * refund was sent is left as it is. Whether it changed.
 */
export async function markUseOwedByHand(
  manager: Executor,
  useId: string,
  due: number
): Promise<boolean> {
  if (!Number.isInteger(due) || due < 0) {
    throw new ValidationError("booking.refund_due_invalid", { field: "refund_due" })
  }
  const changed = await rows(
    manager,
    `UPDATE booking_slot_use
        SET cancel_refund = 'offline', refund_due = ?, bell_checked_at = NULL, updated_at = now()
      WHERE id = ? AND deleted_at IS NULL
        AND (cancel_refund IS NULL OR cancel_refund = 'none')
     RETURNING id`,
    [due, useId]
  )
  return changed.length > 0
}

/** Rows the sweep settled (rung, or nothing owed): they leave its query. How many. */
export async function markBellsChecked(
  manager: Executor,
  useIds: readonly string[]
): Promise<number> {
  if (useIds.length === 0) {
    return 0
  }
  const changed = await rows(
    manager,
    `UPDATE booking_slot_use SET bell_checked_at = now()
      WHERE id IN (${marks(useIds.length)}) AND bell_checked_at IS NULL
     RETURNING id`,
    [...useIds]
  )
  return changed.length
}
