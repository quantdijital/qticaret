import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { kurus } from "../../lib/money"
import { BOOKING_MODULE } from "../../modules/booking"
import type { CancelledUse } from "../../modules/booking/refund-uses"
import type BookingModuleService from "../../modules/booking/service"
import { readOrderMoney } from "../orders/order-money"
import { owedByHand, refundedBefore } from "./cancel-again"
import { alertCashShareByHand, alertRefundByHand, bellKey } from "./confirm-alert"

/**
 * The refund bell caught up (refund safety follow-up of adr/0076 Ek
 * D7a): a cancel that gave the places back but stopped before its
 * `booking.refund_by_hand` bell, or whose bell could not be written,
 * leaves money owed that no one hears of. The reconcile job looks at
 * departures cancelled (or marked owed by hand) in the last days whose
 * money was left to staff (or, kept before, cancelled with their whole
 * departure) and not settled yet, the longest waiting first. With no
 * refund in the ledger for it (`booking<use>`), money taken for the
 * order and no bell yet, the bell rings: a cash on delivery share's own
 * (`booking.cash_share_by_hand`, with the share kept on the row) or the
 * refund's. A row is settled (`bell_checked_at`) once its bell is
 * written or nothing is owed, and leaves the sweep (review O3 of #277);
 * a row that failed stays and is tried on the next run. Bells keep their
 * cancel's key, so one rung before is never repeated.
 */

// How far back the sweep looks, and the most it reads in one run
const SWEEP_DAYS = 7
const SWEEP_LIMIT = 100

export interface RefundBellSweep {
  rung: number
  failed: number
}

const keyOf = (use: CancelledUse) =>
  bellKey(
    use.refund_due === null ? "refund_by_hand" : "cash_share_by_hand",
    use.order_id,
    use.slot_id
  )

/** The keys among `keys` a bell was written for already. */
async function rungAlready(container: MedusaContainer, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) {
    return new Set()
  }
  // A column of Medusa's notification its filter types leave out; the service filters by it
  const filter = { idempotency_key: keys } as Record<string, unknown>
  const found = await container
    .resolve(Modules.NOTIFICATION)
    .listNotifications(filter, { select: ["idempotency_key"] })
  return new Set(
    found.map((row) => (row as { idempotency_key?: string | null }).idempotency_key ?? "")
  )
}

/** Whether the row's bell is to ring now: nothing refunded, money taken, owed by hand. */
async function owes(container: MedusaContainer, use: CancelledUse): Promise<boolean> {
  if (use.refund_due === 0 || (await refundedBefore(container, use.use_id)) > 0) {
    return false
  }
  const money = await readOrderMoney(container, use.order_id)
  // Nothing taken for the order (nor credit used): nothing to give back
  if (money.paid <= 0 && money.credit <= 0) {
    return false
  }
  return owedByHand(container, use.order_id, use.cancel_refund)
}

/** The row's bell: the cash share's (its kept share) or the refund's. Whether it was written. */
const ring = (container: MedusaContainer, use: CancelledUse): Promise<boolean> =>
  use.refund_due === null
    ? alertRefundByHand(container, use.order_id, use.slot_id)
    : alertCashShareByHand(container, use.order_id, use.slot_id, kurus(use.refund_due))

export async function ringLostRefundBells(container: MedusaContainer): Promise<RefundBellSweep> {
  const sweep: RefundBellSweep = { rung: 0, failed: 0 }
  const bookings = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const uses = await bookings.cancelledUsesByHand(SWEEP_DAYS, SWEEP_LIMIT)
  const rung = await rungAlready(container, uses.map(keyOf))
  const settled: string[] = []
  for (const use of uses) {
    try {
      if (rung.has(keyOf(use)) || !(await owes(container, use))) {
        settled.push(use.use_id)
        continue
      }
      if (await ring(container, use)) {
        rung.add(keyOf(use))
        settled.push(use.use_id)
        sweep.rung += 1
      } else {
        sweep.failed += 1
      }
    } catch (error) {
      sweep.failed += 1
      logger.error({
        event: "booking.refund_bell_sweep_failed",
        order_id: use.order_id,
        slot_id: use.slot_id,
        err: errorSummary(error),
      })
    }
  }
  await bookings.markBellsChecked(settled)
  return sweep
}
