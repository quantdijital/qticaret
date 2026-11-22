import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BOOKING_KEY } from "../../lib/booking/cart-lines"
import { errorSummary, logger } from "../../lib/logging"
import { cancelOrderBookingsWorkflow, confirmOrderBookingsWorkflow } from "./orders"

type Container = Pick<MedusaContainer, "resolve">

// Orders a run looks at, per side; the next run takes the rest
export const RECONCILE_PAGE = 50
// How far back a placed order without its booking is looked for (hours)
export const RECONCILE_LOOKBACK_HOURS = 48
// An order this fresh is left to its own `order.placed` delivery (minutes)
export const RECONCILE_SETTLE_MINUTES = 5

/**
 * Placed orders of the last hours with a dated line (`qt_booking`) and no
 * booking: the confirmation missed (its lock timed out, its event lost).
 * Cancelled, draft and very fresh orders are left out, and so is one whose
 * confirmation already failed for want of places (its bell rang; staff
 * settle it by hand, the job does not ring again every run).
 */
export const UNCONFIRMED_ORDERS = `SELECT o.id
  FROM "order" o
 WHERE o.deleted_at IS NULL
   AND o.is_draft_order = false
   AND o.canceled_at IS NULL
   AND o.status::text <> 'canceled'
   AND o.created_at >= now() - make_interval(hours => ?)
   AND o.created_at <= now() - make_interval(mins => ?)
   AND EXISTS (
         SELECT 1
           FROM order_item oi
           JOIN order_line_item li ON li.id = oi.item_id AND li.deleted_at IS NULL
          WHERE oi.order_id = o.id AND oi.version = o.version AND oi.deleted_at IS NULL
            AND li.metadata -> ? IS NOT NULL)
   AND NOT EXISTS (
         SELECT 1 FROM booking b WHERE b.order_id = o.id AND b.deleted_at IS NULL)
   AND NOT EXISTS (
         SELECT 1 FROM notification n
          WHERE n.resource_id = o.id AND n.trigger_type = 'booking.confirm_failed')
 ORDER BY o.created_at, o.id
 LIMIT ?`

/** Cancelled orders whose bookings still count as sold: the cancel missed. */
export const CANCELLED_WITH_BOOKINGS = `SELECT b.order_id, min(b.created_at) AS first
  FROM booking b
  JOIN "order" o ON o.id = b.order_id
 WHERE b.deleted_at IS NULL
   AND b.status = 'confirmed'
   AND (o.canceled_at IS NOT NULL OR o.status::text = 'canceled')
 GROUP BY b.order_id
 ORDER BY first, b.order_id
 LIMIT ?`

export interface ReconcileCounts {
  confirmed: number
  cancelled: number
  failed: number
}

export interface ReconcileActions {
  confirm: (orderId: string) => Promise<unknown>
  cancel: (orderId: string) => Promise<unknown>
  /** One order's failure, counted; the run goes on (ids only, never a person). */
  onError?: (side: "confirm" | "cancel", orderId: string, error: unknown) => void
}

const workflowActions = (container: Container): ReconcileActions => ({
  confirm: (orderId) =>
    confirmOrderBookingsWorkflow(container as MedusaContainer).run({
      input: { order_id: orderId },
    }),
  cancel: (orderId) =>
    cancelOrderBookingsWorkflow(container as MedusaContainer).run({
      input: { order_id: orderId },
    }),
  onError: (side, orderId, error) => {
    logger.warn({
      event: "booking.reconcile_order_failed",
      side,
      order_id: orderId,
      err: errorSummary(error),
    })
  },
})

async function idsOf(knex: Knex, sql: string, params: unknown[], column: string) {
  const result = await knex.raw<{ rows: Record<string, unknown>[] }>(
    sql,
    params as Knex.RawBinding[]
  )
  return result.rows.map((row) => String(row[column]))
}

/**
 * What the order events missed (adr/0076 Ek takip L2), a page per side:
 * a placed order's booking confirmed, a cancelled order's bookings
 * cancelled. Each through the same workflow as the event, under the
 * order's lock and idempotent: a run meeting the event at once, or two
 * runs, change nothing twice; an order whose lock is busy is skipped and
 * the next run tries again. How many of each.
 */
export async function reconcileBookings(
  container: Container,
  actions: ReconcileActions = workflowActions(container)
): Promise<ReconcileCounts> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const counts: ReconcileCounts = { confirmed: 0, cancelled: 0, failed: 0 }
  const unconfirmed = await idsOf(
    knex,
    UNCONFIRMED_ORDERS,
    [RECONCILE_LOOKBACK_HOURS, RECONCILE_SETTLE_MINUTES, BOOKING_KEY, RECONCILE_PAGE],
    "id"
  )
  for (const orderId of unconfirmed) {
    try {
      await actions.confirm(orderId)
      counts.confirmed += 1
    } catch (error) {
      counts.failed += 1
      actions.onError?.("confirm", orderId, error)
    }
  }
  const cancelled = await idsOf(knex, CANCELLED_WITH_BOOKINGS, [RECONCILE_PAGE], "order_id")
  for (const orderId of cancelled) {
    try {
      await actions.cancel(orderId)
      counts.cancelled += 1
    } catch (error) {
      counts.failed += 1
      actions.onError?.("cancel", orderId, error)
    }
  }
  return counts
}
