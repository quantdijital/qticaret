import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { RetryableError, isRetryable } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import type { PaymentVerdict } from "./payment-orphan"

/**
 * Whether a failed completion will fail again: the cart's own rules
 * (it changed, an address, a code, a payment fee or account no longer
 * right, a contract published again since it was accepted, an age not
 * declared) or stock that ran out. Anything else
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
  if (
    typeof safeMessage === "string" &&
    /^(cart|payments|promotions|cash_on_delivery|bank_transfer|legal|age)\./.test(safeMessage)
  ) {
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
  async (verdict: PaymentVerdict, { container }) => {
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
