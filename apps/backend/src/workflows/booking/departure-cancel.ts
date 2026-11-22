import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { kurus, sumKurus, toMedusaAmount } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import type { LiveUse } from "../../modules/booking/service"
import { cancelBookingDeparture } from "./cancel"
import { planBookingCancel } from "./cancel-plan"
import { alertDepartureRefundGivenUp } from "./confirm-alert"
import { RECONCILE_MAX_ATTEMPTS, reconcileAttempts } from "./reconcile-attempts"

/**
 * The shop cancels a whole departure (adr/0076 §8, Ek D7a): the slot is
 * marked `cancelled` at once (no more sales, carts' holds on it given up),
 * then every confirmed booking on it is cancelled with ALL its money for
 * that departure back, one order at a time through the same cancel as the
 * shopper's (`cancelBookingDeparture`, mode `full`, its lock and refund
 * reference). Money taken by hand or with credit is left to staff (the
 * bell rings per order). The work runs after the answer: the event
 * `booking.departure_cancelled` starts it, and the reconcile job picks up
 * any slot cancelled with a live booking left, so a run cut short goes on
 * where it stopped. A provider failure leaves that order's booking as it
 * was (the refund goes first); it is tried again on the next runs, three
 * times a day at most, then the bell rings for staff.
 */

export const DEPARTURE_CANCELLED = "booking.departure_cancelled"

// The bookings one preview reads; a departure larger than this is counted, its refund estimated
const PREVIEW_LIMIT = 500
// The bookings one run handles before it looks again
const PAGE = 50
// Slots the reconcile job works on in one run, and the most it looks through to find them
const RESUME_SLOTS = 10
const RESUME_SCAN = 100

const service = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<BookingModuleService>(BOOKING_MODULE)

/** What a departure's cancel touches: counted, nothing worked out. */
export interface DepartureCancelCounts {
  slot_id: string
  status: string
  bookings: number
  orders: number
  units: number
}

export interface DepartureCancelPreview extends DepartureCancelCounts {
  /** Lira sent back in all, worked out on the server (each booking's departure, all of it). */
  refund: string
  /** Lira left to staff to give back by hand (bank transfer, cash, credit), and its orders. */
  refund_by_hand: string
  by_hand_orders: number
  /** Not every booking was worked out (too many, or one could not be read): sums are at least. */
  partial: boolean
}

async function slotOf(container: MedusaContainer, slotId: string) {
  const [slot] = await service(container).listBookingSlots({ id: slotId }, { take: 1 })
  if (!slot) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
  }
  return slot
}

const countsOf = (slotId: string, status: string, uses: readonly LiveUse[]) => ({
  slot_id: slotId,
  status,
  bookings: uses.length,
  orders: new Set(uses.map((use) => use.order_id)).size,
  units: uses.reduce((sum, use) => sum + use.units, 0),
})

/**
 * What cancelling the departure would touch and give back; read only. An
 * order whose plan cannot be read is left out of the sums and the
 * preview marked `partial` (review D3): one bad order never hides the rest.
 */
export async function previewDepartureCancel(
  container: MedusaContainer,
  slotId: string
): Promise<DepartureCancelPreview> {
  const slot = await slotOf(container, slotId)
  const uses = await service(container).liveUsesOnSlot(slotId, PREVIEW_LIMIT + 1)
  const sent: Kurus[] = []
  const byHand: Kurus[] = []
  const byHandOrders = new Set<string>()
  let unread = false
  for (const use of uses.slice(0, PREVIEW_LIMIT)) {
    try {
      const plan = await planBookingCancel(container, {
        order_id: use.order_id,
        slot_id: slotId,
        mode: "full",
      })
      if (plan?.manual) {
        byHand.push(plan.refund)
        byHandOrders.add(use.order_id)
      } else {
        sent.push(plan?.refund ?? kurus(0))
      }
    } catch (error) {
      unread = true
      logger.warn({
        event: "booking.departure_preview_failed",
        order_id: use.order_id,
        slot_id: slotId,
        err: errorSummary(error),
      })
    }
  }
  return {
    ...countsOf(slotId, slot.status, uses),
    refund: toMedusaAmount(sumKurus(sent)),
    refund_by_hand: toMedusaAmount(sumKurus(byHand)),
    by_hand_orders: byHandOrders.size,
    partial: unread || uses.length > PREVIEW_LIMIT,
  }
}

/**
 * The slot cancelled (no more sales) and its bookings' work started after
 * the answer; the answer counts what it touches, nothing worked out
 * (review D3: no refund is planned inside the request).
 */
export async function startDepartureCancel(
  container: MedusaContainer,
  slotId: string
): Promise<DepartureCancelCounts> {
  await slotOf(container, slotId)
  // Under the slot's lock, as staff's other changes to it (`updateBookingSlotWorkflow`)
  await container
    .resolve(Modules.LOCKING)
    .execute(
      `booking:slot:${slotId}`,
      () => service(container).updateSlot(slotId, { status: "cancelled" }),
      { timeout: 10 }
    )
  const uses = await service(container).liveUsesOnSlot(slotId, PREVIEW_LIMIT + 1)
  await container
    .resolve(Modules.EVENT_BUS)
    .emit({ name: DEPARTURE_CANCELLED, data: { slot_id: slotId } })
  return countsOf(slotId, "cancelled", uses)
}

export interface DepartureRun {
  cancelled: number
  failed: number
  skipped: number
}

const attemptKey = (use: LiveUse) => `departure:${use.slot_id}:${use.order_id}`

/**
 * Every live booking on a cancelled slot cancelled with its refund, a
 * page at a time until none is left or every one left failed this run.
 * One order's failure is logged (its id only) and the run goes on; its
 * last try of the day rings the bell (review O4).
 */
export async function processDepartureCancel(
  container: MedusaContainer,
  slotId: string
): Promise<DepartureRun> {
  const slot = await slotOf(container, slotId)
  const run: DepartureRun = { cancelled: 0, failed: 0, skipped: 0 }
  if (slot.status !== "cancelled") {
    return run
  }
  const attempts = reconcileAttempts()
  const tried = new Set<string>()
  for (;;) {
    const page = (await service(container).liveUsesOnSlot(slotId, PAGE + tried.size)).filter(
      (use) => !tried.has(use.booking_id)
    )
    if (page.length === 0) {
      return run
    }
    for (const use of page) {
      tried.add(use.booking_id)
      if ((await attempts.count(attemptKey(use))) >= RECONCILE_MAX_ATTEMPTS) {
        run.skipped += 1
        continue
      }
      try {
        await cancelBookingDeparture(container, {
          order_id: use.order_id,
          slot_id: slotId,
          mode: "full",
          by: "shop",
        })
        await attempts.clear(attemptKey(use))
        run.cancelled += 1
      } catch (error) {
        run.failed += 1
        const failures = await attempts.fail(attemptKey(use))
        const givenUp = failures >= RECONCILE_MAX_ATTEMPTS
        logger.error({
          event: givenUp ? "booking.departure_refund_given_up" : "booking.departure_refund_failed",
          order_id: use.order_id,
          slot_id: slotId,
          err: errorSummary(error),
        })
        if (givenUp) {
          await alertDepartureRefundGivenUp(container, use.order_id, slotId)
        }
      }
    }
  }
}

/**
 * The reconcile job's share: cancelled slots with a booking left, the
 * longest waiting first, each carried on (review D4). A slot whose every
 * booking was given up for the day does no work and does not count: the
 * job looks further, so such slots never keep the others waiting.
 */
export async function resumeDepartureCancels(container: MedusaContainer): Promise<DepartureRun> {
  const total: DepartureRun = { cancelled: 0, failed: 0, skipped: 0 }
  let worked = 0
  for (const slotId of await service(container).cancelledSlotsWithLiveUses(RESUME_SCAN)) {
    if (worked >= RESUME_SLOTS) {
      break
    }
    const run = await processDepartureCancel(container, slotId)
    total.cancelled += run.cancelled
    total.failed += run.failed
    total.skipped += run.skipped
    if (run.cancelled + run.failed > 0) {
      worked += 1
    }
  }
  return total
}
