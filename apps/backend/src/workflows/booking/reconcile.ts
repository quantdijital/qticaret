import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BOOKING_KEY } from "../../lib/booking/cart-lines"
import { errorSummary, logger } from "../../lib/logging"
import { sendBookingConfirmations } from "./messages"
import { cancelOrderBookingsWorkflow, confirmOrderBookingsWorkflow } from "./orders"
import type { ConfirmOutcome } from "./orders"
import { RECONCILE_MAX_ATTEMPTS, reconcileAttempts } from "./reconcile-attempts"
import type { ReconcileAttempts } from "./reconcile-attempts"

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
 ORDER BY o.created_at DESC, o.id DESC
 LIMIT ?`

/** Cancelled orders whose bookings still count as sold: the cancel missed. */
export const CANCELLED_WITH_BOOKINGS = `SELECT b.order_id, min(b.created_at) AS first
  FROM booking b
  JOIN "order" o ON o.id = b.order_id
 WHERE b.deleted_at IS NULL
   AND b.status = 'confirmed'
   AND (o.canceled_at IS NOT NULL OR o.status::text = 'canceled')
 GROUP BY b.order_id
 ORDER BY first DESC, b.order_id DESC
 LIMIT ?`

export interface ReconcileCounts {
  /** Bookings this run wrote (confirmed, or retaken and confirmed). */
  confirmed: number
  /** The order event got there first: its booking was already written. */
  existing: number
  /** Nothing to confirm: no dated line, no places to retake, or cancelled meanwhile. */
  none: number
  cancelled: number
  /** Thrown, or no place left for the order (its bell rang). */
  failed: number
  /** Left alone after `RECONCILE_MAX_ATTEMPTS` failed tries. */
  given_up: number
}

export interface ReconcileActions {
  /** `quiet`: neither the first nor the last try, so a failure logs no error line. */
  confirm: (orderId: string, quiet: boolean) => Promise<ConfirmOutcome>
  cancel: (orderId: string) => Promise<unknown>
  /** One order's failure, counted; the run goes on (ids only, never a person). */
  onError?: (side: "confirm" | "cancel", orderId: string, error: unknown) => void
}

const workflowActions = (container: Container): ReconcileActions => ({
  confirm: async (orderId, quiet) => {
    const { result } = await confirmOrderBookingsWorkflow(container as MedusaContainer).run({
      input: { order_id: orderId, quiet },
    })
    // A booking the order event missed gets its confirmation e-mail here (adr/0076 Ek D7b)
    if (result === "confirmed" || result === "retaken") {
      await sendBookingConfirmations(container as MedusaContainer, orderId)
    }
    return result
  },
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

const COUNTED: Record<Exclude<ConfirmOutcome, "failed">, "confirmed" | "existing" | "none"> = {
  confirmed: "confirmed",
  retaken: "confirmed",
  existing: "existing",
  none: "none",
  canceled: "none",
}

/**
 * One order's tries (`ReconcileAttempts`): which try this is, or null once
 * it has had them all; a failure counted, the last one warned of once; a
 * success forgetting the earlier ones. The counters failing (Redis down)
 * never stop the run: the order is simply tried as a first time.
 */
function triesOf(attempts: ReconcileAttempts) {
  return {
    next: async (orderId: string): Promise<number | null> => {
      const before = await attempts.count(orderId).catch(() => 0)
      return before >= RECONCILE_MAX_ATTEMPTS ? null : before + 1
    },
    failed: async (side: "confirm" | "cancel", orderId: string): Promise<void> => {
      const now = await attempts.fail(orderId).catch(() => 0)
      if (now === RECONCILE_MAX_ATTEMPTS) {
        logger.warn({
          event: "booking.reconcile_given_up",
          side,
          order_id: orderId,
          tries: now,
        })
      }
    },
    succeeded: async (orderId: string, attempt: number): Promise<void> => {
      if (attempt > 1) {
        await attempts.clear(orderId).catch(() => undefined)
      }
    },
  }
}

/**
 * What the order events missed (adr/0076 Ek takip L2), a page per side,
 * newest first (an order that keeps failing never hides a fresh one): a
 * placed order's booking confirmed, a cancelled order's bookings
 * cancelled. Each through the same workflow as the event, under the
 * order's lock and idempotent: a run meeting the event at once, or two
 * runs, change nothing twice; an order whose lock is busy is skipped and
 * the next run tries again, `RECONCILE_MAX_ATTEMPTS` times a day at most,
 * its failure logged on the first and the last try only. How many of each.
 */
export async function reconcileBookings(
  container: Container,
  actions: ReconcileActions = workflowActions(container),
  attempts: ReconcileAttempts = reconcileAttempts()
): Promise<ReconcileCounts> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const tries = triesOf(attempts)
  const counts: ReconcileCounts = {
    confirmed: 0,
    existing: 0,
    none: 0,
    cancelled: 0,
    failed: 0,
    given_up: 0,
  }
  const each = async (
    side: "confirm" | "cancel",
    orderId: string,
    run: (quiet: boolean) => Promise<"failed" | null>
  ) => {
    const attempt = await tries.next(orderId)
    if (attempt === null) {
      counts.given_up += 1
      return
    }
    const quiet = attempt > 1 && attempt < RECONCILE_MAX_ATTEMPTS
    try {
      if ((await run(quiet)) === "failed") {
        counts.failed += 1
        await tries.failed(side, orderId)
        return
      }
      await tries.succeeded(orderId, attempt)
    } catch (error) {
      counts.failed += 1
      if (!quiet) {
        actions.onError?.(side, orderId, error)
      }
      await tries.failed(side, orderId)
    }
  }
  const unconfirmed = await idsOf(
    knex,
    UNCONFIRMED_ORDERS,
    [RECONCILE_LOOKBACK_HOURS, RECONCILE_SETTLE_MINUTES, BOOKING_KEY, RECONCILE_PAGE],
    "id"
  )
  for (const orderId of unconfirmed) {
    await each("confirm", orderId, async (quiet) => {
      const outcome = await actions.confirm(orderId, quiet)
      if (outcome === "failed") {
        return "failed"
      }
      counts[COUNTED[outcome]] += 1
      return null
    })
  }
  const cancelled = await idsOf(knex, CANCELLED_WITH_BOOKINGS, [RECONCILE_PAGE], "order_id")
  for (const orderId of cancelled) {
    await each("cancel", orderId, async () => {
      await actions.cancel(orderId)
      counts.cancelled += 1
      return null
    })
  }
  return counts
}
