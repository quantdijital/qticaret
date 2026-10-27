import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { PAYMENT_RECOVERY_MODULE } from "../modules/payment-recovery"
import type PaymentRecoveryModuleService from "../modules/payment-recovery/service"
import { recoverPaymentWorkflow } from "../workflows/payments/recover-payment"
import type { RecoveryOutcome } from "../workflows/payments/recover-payment"

// A run gives back at most this many; the rest wait five minutes
const BATCH = 50
// Providers the job can refund: iyzico joins in F5 V10. Rows of others must not fill the batch
const REFUNDABLE = ["paytr"]

/** Gives back payments that became no order (adr/0026 §6), oldest first. */
export default async function paymentRecovery(container: MedusaContainer) {
  const pending = await container
    .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
    .listPaymentRecoveries(
      { status: "pending", provider: REFUNDABLE },
      { select: ["id"], take: BATCH, order: { created_at: "ASC" } }
    )
  const outcomes: Partial<Record<RecoveryOutcome | "error", number>> = {}
  for (const { id } of pending) {
    const outcome = await recoverPaymentWorkflow(container)
      .run({ input: id })
      .then(({ result }) => result)
      .catch((error: unknown) => {
        logger.warn({ event: "payments.recovery_failed", recoveryId: id, err: errorSummary(error) })
        return "error" as const
      })
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1
  }
  if (pending.length > 0) {
    logger.info({ event: "payments.recovery", ...outcomes })
  }
}

export const config = {
  name: "payment-recovery",
  schedule: "*/5 * * * *",
}
