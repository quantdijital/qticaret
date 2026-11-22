import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { kurus, sumKurus, toMedusaAmount } from "../../lib/money"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import type { LiveUse } from "../../modules/booking/service"
import { cancelBookingDeparture } from "./cancel"
import { planBookingCancel } from "./cancel-plan"
import { RECONCILE_MAX_ATTEMPTS, reconcileAttempts } from "./reconcile-attempts"

/**
 * The shop cancels a whole departure (adr/0076 §8, Ek D7a): the slot is
 * marked `cancelled` at once (no more sales), then every confirmed
 * booking on it is cancelled with ALL its money for that departure back,
 * one order at a time through the same cancel as the shopper's
 * (`cancelBookingDeparture`, mode `full`, its lock and refund reference).
 * The work runs after the answer: the event `booking.departure_cancelled`
 * starts it, and the reconcile job picks up any slot cancelled with a
 * live booking left, so a run cut short goes on where it stopped. A
 * provider failure leaves that order's booking as it was (the refund goes
 * first); it is tried again on the next runs, three times a day at most,
 * then logged for staff.
 */

export const DEPARTURE_CANCELLED = "booking.departure_cancelled"

// The bookings one preview reads; a departure larger than this is counted, its refund estimated
const PREVIEW_LIMIT = 500
// The bookings one run handles before it looks again
const PAGE = 50
// Slots the reconcile job resumes in one run
const RESUME_SLOTS = 10

const service = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<BookingModuleService>(BOOKING_MODULE)

export interface DepartureCancelPreview {
  slot_id: string
  status: string
  bookings: number
  orders: number
  units: number
  /** Lira back in all, worked out on the server (each booking's departure, all of it). */
  refund: string
  /** More bookings than the preview reads: the counts are exact, the refund only theirs. */
  partial: boolean
}

async function slotOf(container: MedusaContainer, slotId: string) {
  const [slot] = await service(container).listBookingSlots({ id: slotId }, { take: 1 })
  if (!slot) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
  }
  return slot
}

/** What cancelling the departure would touch and give back; read only. */
export async function previewDepartureCancel(
  container: MedusaContainer,
  slotId: string
): Promise<DepartureCancelPreview> {
  const slot = await slotOf(container, slotId)
  const uses = await service(container).liveUsesOnSlot(slotId, PREVIEW_LIMIT + 1)
  const read = uses.slice(0, PREVIEW_LIMIT)
  const refunds = []
  for (const use of read) {
    const plan = await planBookingCancel(container, {
      order_id: use.order_id,
      slot_id: slotId,
      mode: "full",
    })
    refunds.push(plan?.refund ?? kurus(0))
  }
  return {
    slot_id: slotId,
    status: slot.status,
    bookings: uses.length,
    orders: new Set(uses.map((use) => use.order_id)).size,
    units: uses.reduce((sum, use) => sum + use.units, 0),
    refund: toMedusaAmount(sumKurus(refunds)),
    partial: uses.length > PREVIEW_LIMIT,
  }
}

/** The slot cancelled (no more sales) and its bookings' work started after the answer. */
export async function startDepartureCancel(
  container: MedusaContainer,
  slotId: string
): Promise<DepartureCancelPreview> {
  await slotOf(container, slotId)
  // Under the slot's lock, as staff's other changes to it (`updateBookingSlotWorkflow`)
  await container
    .resolve(Modules.LOCKING)
    .execute(
      `booking:slot:${slotId}`,
      () => service(container).updateSlot(slotId, { status: "cancelled" }),
      { timeout: 10 }
    )
  const preview = await previewDepartureCancel(container, slotId)
  await container
    .resolve(Modules.EVENT_BUS)
    .emit({ name: DEPARTURE_CANCELLED, data: { slot_id: slotId } })
  return preview
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
 * One order's failure is logged (its id only) and the run goes on.
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
        logger.error({
          event:
            failures >= RECONCILE_MAX_ATTEMPTS
              ? "booking.departure_refund_given_up"
              : "booking.departure_refund_failed",
          order_id: use.order_id,
          slot_id: slotId,
          err: errorSummary(error),
        })
      }
    }
  }
}

/** The reconcile job's share: cancelled slots with a booking left, each carried on. */
export async function resumeDepartureCancels(container: MedusaContainer): Promise<DepartureRun> {
  const total: DepartureRun = { cancelled: 0, failed: 0, skipped: 0 }
  for (const slotId of await service(container).cancelledSlotsWithLiveUses(RESUME_SLOTS)) {
    const run = await processDepartureCancel(container, slotId)
    total.cancelled += run.cancelled
    total.failed += run.failed
    total.skipped += run.skipped
  }
  return total
}
