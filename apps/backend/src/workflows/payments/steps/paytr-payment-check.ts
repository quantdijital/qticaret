import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { RetryableError } from "../../../lib/errors"
import { paytrApi, paytrCredentialsOf } from "../../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"
import type { PaymentVerdict } from "./payment-orphan"
import type { PaytrClaim, PaytrNotification, PaytrTarget } from "./paytr-notification"

/**
 * What to do with a notification's payment (adr/0026 §4, §6), after PayTR
 * was asked again: place the order, or give the money back. The money is
 * given back by the recovery job, once PayTR has had its "OK" (it refunds
 * no payment whose notification went unanswered, `007`).
 */
export type PaytrVerdict = PaymentVerdict

/** Kuruş PayTR shows given back on a payment, whoever gave it. */
export const refundedKurus = (refunds: readonly { amount: number }[]): number =>
  refunds.reduce(
    (sum, entry) => sum + (Number.isFinite(entry.amount) ? Math.max(0, entry.amount) : 0),
    0
  )

export const checkPaytrPaymentStep = createStep(
  "payments-check-paytr-payment",
  async (
    input: { notification: PaytrNotification; target: PaytrTarget | null; claim: PaytrClaim },
    { container }
  ) => {
    const { notification, target, claim } = input
    const handling = claim.state === "new" || claim.state === "retry"
    if (!target || !handling || notification.status !== "success") {
      return new StepResponse<PaytrVerdict>({ kind: "skip" })
    }
    const account = paytrCredentialsOf(
      await container
        .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
        .read("paytr")
    )
    if (!account) {
      throw new RetryableError("paytr.not_configured")
    }
    const paid = await paytrApi().queryStatus(account, notification.merchant_oid)
    if (!paid) {
      // The notification came before PayTR's own record shows the payment: later
      throw new RetryableError("paytr.payment_not_visible")
    }
    const taken = {
      amount: paid.paymentAmount,
      currency_code: paid.currencyCode,
      test_mode: paid.testMode,
    }
    // Refunded by hand in PayTR's panel: never an order, nor refunded again (security review 2026-11-09)
    const refunded = refundedKurus(paid.refunds)
    if (refunded > 0) {
      return new StepResponse<PaytrVerdict>({
        kind: "refunded",
        cart_id: target.orphan ? null : target.cart_id,
        provider: "paytr",
        reference: notification.merchant_oid,
        amount: taken.amount,
        refunded,
      })
    }
    if (target.orphan) {
      return new StepResponse<PaytrVerdict>({
        kind: "orphan",
        reason: "session_gone",
        ...taken,
        cart_id: null,
      })
    }
    const { expected } = target
    const matches =
      taken.amount === expected.amount &&
      taken.currency_code === expected.currency_code &&
      taken.test_mode === expected.test_mode
    return new StepResponse<PaytrVerdict>(
      matches
        ? {
            kind: "complete",
            cart_id: target.cart_id,
            ...taken,
            provider: "paytr",
            reference: notification.merchant_oid,
            session_id: target.session_id,
            attempts: claim.attempts,
          }
        : { kind: "orphan", reason: "amount_mismatch", ...taken, cart_id: target.cart_id }
    )
  }
)
