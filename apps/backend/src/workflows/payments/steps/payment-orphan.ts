import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { alertRecovery } from "../../../lib/payments/recovery-alert"
import { PAYMENT_RECOVERY_MODULE } from "../../../modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../../modules/payment-recovery/service"
import type { RecoveryInput } from "../../../modules/payment-recovery/service"

/** A hosted form's verdict on a payment, as the orphan step reads it. */
export type PaymentVerdict =
  | { kind: "skip" }
  | { kind: "complete"; cart_id: string; amount: number; currency_code: string; test_mode: boolean }
  | {
      kind: "orphan"
      reason: RecoveryInput["reason"]
      amount: number
      currency_code: string
      test_mode: boolean
      cart_id: string | null
    }

/**
 * A payment that became no order, recorded once for the recovery job, with
 * an alert (adr/0026 §6): a verdict of orphan, or a paid cart that will not
 * complete. `reference` is the provider's own for the payment.
 */
export const recordPaymentOrphanStep = createStep(
  "payments-record-orphan",
  async (
    input: {
      provider: string
      reference: string
      verdict: PaymentVerdict
      completion: { order_id: string | null; will_fail_again: boolean }
    },
    { container }
  ) => {
    const { verdict, completion, provider, reference } = input
    const orphan: RecoveryInput | null =
      verdict.kind === "orphan"
        ? { provider, reference, ...verdict }
        : verdict.kind === "complete" && completion.will_fail_again
          ? {
              provider,
              reference,
              reason: "completion_failed",
              // What the provider took for the order (its record), not a surcharge on top
              amount: verdict.amount,
              currency_code: verdict.currency_code,
              test_mode: verdict.test_mode,
              cart_id: verdict.cart_id,
            }
          : null
    if (!orphan) {
      return new StepResponse<string | null>(null)
    }
    const recorded = await container
      .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
      .recordOrphan(orphan)
    if (recorded.created) {
      logger.error({ event: "payments.orphan_recorded", provider, reference })
      // An alert that cannot be written must not lose the record: the job alerts again on refund
      await alertRecovery(container, "orphan_recorded", { id: recorded.id, ...orphan }).catch(
        (error: unknown) => {
          logger.warn({ event: "payments.orphan_alert_failed", err: errorSummary(error) })
        }
      )
    }
    return new StepResponse<string | null>(recorded.id)
  }
)
