import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { RetryableError, isRetryable } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
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
        ? { kind: "complete", cart_id: target.cart_id, ...taken }
        : { kind: "orphan", reason: "amount_mismatch", ...taken, cart_id: target.cart_id }
    )
  }
)

/**
 * Whether a failed completion will fail again: the cart's own rules
 * (it changed, an address, a code) or stock that ran out. Anything else
 * (a lock, the provider unreachable) is tried again: money is given back
 * only when the order surely cannot be placed.
 */
function completionWillFailAgain(error: unknown): boolean {
  if (isRetryable(error)) {
    return false
  }
  const { safeMessage, message, type } = error as {
    safeMessage?: unknown
    message?: unknown
    type?: unknown
  }
  if (typeof safeMessage === "string" && /^(cart|payments|promotions)\./.test(safeMessage)) {
    return true
  }
  return (
    type === MedusaError.Types.NOT_ALLOWED &&
    typeof message === "string" &&
    /inventory/i.test(message)
  )
}

/**
 * Places the order under Medusa's cart lock; a completed cart returns its
 * order. Any hosted form's verdict (PayTR's, iyzico's) of this shape.
 */
export const completePaidCartStep = createStep(
  "payments-complete-paid-cart",
  async (verdict: PaytrVerdict, { container }) => {
    if (verdict.kind !== "complete") {
      return new StepResponse<{ order_id: string | null; will_fail_again: boolean }>({
        order_id: null,
        will_fail_again: false,
      })
    }
    const { result, errors } = await completeCartWorkflow(container).run({
      input: { id: verdict.cart_id },
      throwOnError: false,
    })
    const error: unknown = errors[0]?.error
    if (!error) {
      return new StepResponse({ order_id: result.id, will_fail_again: false })
    }
    if (!completionWillFailAgain(error)) {
      throw new RetryableError("payments.completion_failed", { cause: error })
    }
    logger.warn({
      event: "payments.completion_refused",
      cartId: verdict.cart_id,
      err: errorSummary(error),
    })
    return new StepResponse({ order_id: null, will_fail_again: true })
  }
)
