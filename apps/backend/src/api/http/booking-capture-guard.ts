import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { cancelLockKeys } from "../../lib/orders/locks"
import { refuseMoneyForCancelledDeparture } from "../../workflows/booking/paid-guard"
import { orderOfPayment } from "../../workflows/gift-cards/issue-and-send"

/**
 * Medusa's capture of a payment (cash on delivery's "collected", a card
 * held) refused for an order one of whose departures was cancelled
 * before the money was taken (review O3, `booking.departure_cancelled_unpaid`).
 * Checked and run under the order's cancel locks, the ones a booking
 * cancel holds, so a cancel and a capture never cross. A payment of no
 * order goes on as before.
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
    const orderId = await orderOfPayment(req.scope, req.params["id"] ?? "")
    if (!orderId) {
      state.started = true
      next()
      return
    }
    await req.scope.resolve(Modules.LOCKING).execute(
      cancelLockKeys(orderId),
      async () => {
        await refuseMoneyForCancelledDeparture(req.scope, orderId)
        await new Promise<void>((resolve) => {
          state.started = true
          res.once("finish", resolve)
          res.once("close", resolve)
          next()
        })
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
