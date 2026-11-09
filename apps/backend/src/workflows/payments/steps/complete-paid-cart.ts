import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { RetryableError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { completionFailureOf } from "../../../lib/payments/completion"
import { completePaidCartAsBackorderWorkflow } from "../complete-backorder"
import { alertPaymentIssue } from "../issue-alert"
import { markStockShortFromShelf } from "../stock-short-mark"
import type { PaymentVerdict } from "./payment-orphan"

export interface PaidCartCompletion {
  order_id: string | null
  will_fail_again: boolean
}

/** From this many takes of one notice, a payment still not an order is the shop's to see. */
export const STUCK_ATTEMPTS = 5

type Complete = Extract<PaymentVerdict, { kind: "complete" }>

async function completedBefore(container: MedusaContainer, cartId: string): Promise<boolean> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["completed_at"],
    filters: { id: cartId },
  })
  return Boolean((data[0] as { completed_at?: unknown } | undefined)?.completed_at)
}

const stuck = (container: MedusaContainer, verdict: Complete) =>
  alertPaymentIssue(container, {
    issue: "completion_stuck",
    provider: verdict.provider ?? "unknown",
    reference: verdict.reference ?? verdict.cart_id,
    cart_id: verdict.cart_id,
    amount: verdict.amount,
  })

/**
 * Places the order under Medusa's cart lock; a completed cart returns its
 * order. Any hosted form's verdict (PayTR's, iyzico's) of this shape.
 * A paid cart always becomes an order (adr/0026 Ek 2026-11-06): one the
 * shelf refuses is placed short of stock, for the shop to make good or
 * refund. One its own rules refuse is given back (`will_fail_again`);
 * anything else is tried again with the provider's next notice, and the
 * shop is told when the shelf refuses it even so, or the notice has come
 * many times. A cart completed by an earlier take whose order a crash
 * left unmarked is marked from the shelf now.
 */
export const completePaidCartStep = createStep(
  "payments-complete-paid-cart",
  async (verdict: PaymentVerdict, { container }) => {
    if (verdict.kind !== "complete") {
      return new StepResponse<PaidCartCompletion>({ order_id: null, will_fail_again: false })
    }
    const repeat = await completedBefore(container, verdict.cart_id)
    const { result, errors } = await completeCartWorkflow(container).run({
      input: { id: verdict.cart_id },
      throwOnError: false,
    })
    let error: unknown = errors[0]?.error
    if (!error) {
      if (repeat) {
        await markStockShortFromShelf(container, result.id)
      }
      return new StepResponse<PaidCartCompletion>({ order_id: result.id, will_fail_again: false })
    }
    let failure = completionFailureOf(error)
    if (failure === "stock") {
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
      failure = completionFailureOf(error)
      if (failure !== "refund") {
        // The shelf refused it even so (no warehouse for the channel, a lock): the shop sees it
        logger.error({
          event: "payments.backorder_failed",
          cartId: verdict.cart_id,
          err: errorSummary(error),
        })
        await stuck(container, verdict)
      }
    } else if (failure === "retry" && (verdict.attempts ?? 0) >= STUCK_ATTEMPTS) {
      await stuck(container, verdict)
    }
    if (failure !== "refund") {
      // Never refunded on its own: the next notice (or the reconcile job) tries again
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
