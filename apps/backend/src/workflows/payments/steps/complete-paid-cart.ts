import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { RetryableError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { completionFailureOf } from "../../../lib/payments/completion"
import { completePaidCartAsBackorderWorkflow } from "../complete-backorder"
import type { PaymentVerdict } from "./payment-orphan"

export interface PaidCartCompletion {
  order_id: string | null
  will_fail_again: boolean
}

/**
 * Places the order under Medusa's cart lock; a completed cart returns its
 * order. Any hosted form's verdict (PayTR's, iyzico's) of this shape.
 * A paid cart always becomes an order (adr/0026 Ek 2026-11-06): one the
 * shelf refuses is placed short of stock, for the shop to make good or
 * refund. One its own rules refuse is given back (`will_fail_again`);
 * anything else is tried again with the provider's next notice.
 */
export const completePaidCartStep = createStep(
  "payments-complete-paid-cart",
  async (verdict: PaymentVerdict, { container }) => {
    if (verdict.kind !== "complete") {
      return new StepResponse<PaidCartCompletion>({ order_id: null, will_fail_again: false })
    }
    const { result, errors } = await completeCartWorkflow(container).run({
      input: { id: verdict.cart_id },
      throwOnError: false,
    })
    let error: unknown = errors[0]?.error
    if (!error) {
      return new StepResponse<PaidCartCompletion>({ order_id: result.id, will_fail_again: false })
    }
    if (completionFailureOf(error) === "stock") {
      logger.warn({
        event: "payments.completion_stock_short",
        cartId: verdict.cart_id,
        err: errorSummary(error),
      })
      const backorder = await completePaidCartAsBackorderWorkflow(container).run({
        input: { cart_id: verdict.cart_id },
        throwOnError: false,
      })
      error = backorder.errors[0]?.error
      if (!error) {
        return new StepResponse<PaidCartCompletion>({
          order_id: backorder.result.order_id,
          will_fail_again: false,
        })
      }
    }
    if (completionFailureOf(error) !== "refund") {
      // The shelf again (a level gone meanwhile), a lock, the database: the next notice tries again
      throw new RetryableError("payments.completion_failed", { cause: error })
    }
    logger.warn({
      event: "payments.completion_refused",
      cartId: verdict.cart_id,
      err: errorSummary(error),
    })
    return new StepResponse<PaidCartCompletion>({ order_id: null, will_fail_again: true })
  }
)
