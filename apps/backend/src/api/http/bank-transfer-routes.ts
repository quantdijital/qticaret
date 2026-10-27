import { validateAndTransformBody } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { bankTransferLockKey } from "../../lib/payments/bank-transfer"
import { AdminPostBankTransferConfirm } from "../admin/orders/[id]/bank-transfer/confirm/validators"
import { requireUserActor } from "./actor"

/**
 * Medusa's cancel of an order takes the lock the bank transfer's
 * confirmation and expiry take (adr/0029): money confirmed while the order
 * is being cancelled, or the other way round, waits its turn. Held until
 * the answer has gone.
 */
export async function holdBankTransferLock(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "POST") {
    next()
    return
  }
  // Set inside the job: whether `next` was already called
  const state = { started: false }
  try {
    await req.scope.resolve(Modules.LOCKING).execute(
      bankTransferLockKey(req.params["id"] ?? ""),
      () =>
        new Promise<void>((resolve) => {
          state.started = true
          res.once("finish", resolve)
          res.once("close", resolve)
          next()
        }),
      { timeout: 10 }
    )
  } catch (error) {
    if (!state.started) {
      next(error)
      return
    }
    logger.warn({ event: "payments.bank_transfer_lock_release_failed", err: errorSummary(error) })
  }
}

/** F6 W2 (adr/0029): a staff member confirms a bank transfer's money; integration keys cannot. */
export const BANK_TRANSFER_ROUTES = [
  {
    matcher: "/admin/orders/:id/bank-transfer/confirm",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostBankTransferConfirm)],
  },
]
