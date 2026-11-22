import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { readOrderMoney } from "../orders/order-money"
import { owedByHand, refundedBefore } from "./cancel-again"
import { alertRefundByHand, bellKey } from "./confirm-alert"

/**
 * The refund bell caught up (refund safety follow-up of adr/0076 Ek
 * D7a): a cancel that gave the places back but stopped before its
 * `booking.refund_by_hand` bell, or whose bell could not be written,
 * leaves money owed that no one hears of. The reconcile job looks at
 * departures cancelled in the last days whose money was left to staff
 * (or, kept before, cancelled with their whole departure): with no
 * refund in the ledger for it (`booking<use>`), money taken for the
 * order and no bell yet, the bell rings. Its key is the cancel's
 * (once per order and departure), so a bell rung before is never
 * repeated. One order's failure is logged with its ids and the sweep
 * goes on.
 */

// How far back the sweep looks, and the most it reads in one run
const SWEEP_DAYS = 7
const SWEEP_LIMIT = 100

export interface RefundBellSweep {
  rung: number
  failed: number
}

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

export async function ringLostRefundBells(container: MedusaContainer): Promise<RefundBellSweep> {
  const sweep: RefundBellSweep = { rung: 0, failed: 0 }
  const uses = await container
    .resolve<BookingModuleService>(BOOKING_MODULE)
    .cancelledUsesByHand(SWEEP_DAYS, SWEEP_LIMIT)
  const keyOf = (use: (typeof uses)[number]) => bellKey("refund_by_hand", use.order_id, use.slot_id)
  const rung = await rungAlready(container, uses.map(keyOf))
  for (const use of uses) {
    if (rung.has(keyOf(use))) {
      continue
    }
    try {
      if ((await refundedBefore(container, use.use_id)) > 0) {
        continue
      }
      const money = await readOrderMoney(container, use.order_id)
      // Nothing taken for the order (nor credit used): nothing to give back
      if (money.paid <= 0 && money.credit <= 0) {
        continue
      }
      if (!(await owedByHand(container, use.order_id, use.cancel_refund))) {
        continue
      }
      await alertRefundByHand(container, use.order_id, use.slot_id)
      rung.add(keyOf(use))
      sweep.rung += 1
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
  return sweep
}
