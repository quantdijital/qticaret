import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { cancelLockKeys } from "../../lib/orders/locks"
import type { CancelledUse } from "../../modules/booking/refund-uses"
import { alertRefundByHand } from "../../workflows/booking/confirm-alert"
import { captureForCancelledDeparture } from "../../workflows/booking/paid-guard"
import { orderOfPayment } from "../../workflows/gift-cards/issue-and-send"

/**
 * Medusa's capture of a payment (cash on delivery's "collected", a card
 * held) for an order one of whose departures was cancelled before the
 * money was taken (review O3): refused (`booking.departure_cancelled_unpaid`)
 * unless it is cash on delivery for an order with a line still to
 * deliver; then the departures' money is owed back by hand and the bell
 * rings once the capture went through (`captureForCancelledDeparture`,
 * refund safety follow-up). Checked and run under the order's cancel
 * locks, the ones a booking cancel holds, so a cancel and a capture never
 * cross. A payment of no order goes on as before.
 */
export async function refuseCaptureForCancelledDeparture(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  if (req.method !== "POST") {
    next()
    return
  }
  // Set inside the job: whether `next` was already called
  const state = { started: false }
  try {
    const paymentId = req.params["id"] ?? ""
    const orderId = await orderOfPayment(req.scope, paymentId)
    if (!orderId) {
      state.started = true
      next()
      return
    }
    await req.scope.resolve(Modules.LOCKING).execute(
      cancelLockKeys(orderId),
      async () => {
        const owed = await captureForCancelledDeparture(req.scope, orderId, paymentId)
        await new Promise<void>((resolve) => {
          state.started = true
          res.once("finish", resolve)
          res.once("close", resolve)
          next()
        })
        if (owed.length > 0 && res.statusCode < 400) {
          await ringOwed(req, orderId, owed)
        }
      },
      { timeout: 10 }
    )
  } catch (error) {
    if (!state.started) {
      next(error)
      return
    }
    logger.warn({ event: "booking.capture_lock_release_failed", err: errorSummary(error) })
  }
}

/** The refund bell for each cancelled departure the collected cash paid for (never fails). */
async function ringOwed(
  req: MedusaRequest,
  orderId: string,
  owed: readonly CancelledUse[]
): Promise<void> {
  for (const slotId of new Set(owed.map((use) => use.slot_id))) {
    await alertRefundByHand(req.scope, orderId, slotId)
  }
}
