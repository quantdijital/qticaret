import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { RetryableError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { completionFailureOf } from "../../../lib/payments/completion"
import { completePaidCartAsBackorderWorkflow } from "../complete-backorder"
import { alertPaymentIssue } from "../issue-alert"
import { holdsSession, placedOrderOfCart } from "../placed-order"
import type { PlacedOrder } from "../placed-order"
import { markStockShortFromShelf } from "../stock-short-mark"
import type { PaymentVerdict } from "./payment-orphan"

export interface PaidCartCompletion {
  order_id: string | null
  will_fail_again: boolean
}

/** From this many takes of one notice, a payment still not an order is the shop's to see. */
export const STUCK_ATTEMPTS = 5

type Complete = Extract<PaymentVerdict, { kind: "complete" }>

const stuck = (container: MedusaContainer, verdict: Complete) =>
  alertPaymentIssue(container, {
    issue: "completion_stuck",
    provider: verdict.provider ?? "unknown",
    reference: verdict.reference ?? verdict.cart_id,
    cart_id: verdict.cart_id,
    amount: verdict.amount,
  })

/**
 * A cart that is already an order (a repeated or late notice, finding
 * 2026-11-16): answered with that order, nothing judged again, never
 * given back. A payment the order does not hold (another session's,
 * review N2) is the shop's to look at, never given back on its own either.
 * A cart marked completed whose order cannot be read is tried again.
 */
async function answeredBefore(
  container: MedusaContainer,
  verdict: Complete,
  placed: PlacedOrder
): Promise<PaidCartCompletion> {
  if (!placed.order_id) {
    throw new RetryableError("payments.completed_cart_without_order")
  }
  if (!holdsSession(placed, verdict.session_id)) {
    logger.error({
      event: "payments.payment_beside_order",
      cartId: verdict.cart_id,
      orderId: placed.order_id,
      sessionId: verdict.session_id,
    })
    await alertPaymentIssue(container, {
      issue: "payment_beside_order",
      provider: verdict.provider ?? "unknown",
      reference: verdict.reference ?? verdict.cart_id,
      cart_id: verdict.cart_id,
      amount: verdict.amount,
    })
  }
  // An earlier take whose order a crash left unmarked is marked from the shelf now
  await markStockShortFromShelf(container, placed.order_id)
  return { order_id: placed.order_id, will_fail_again: false }
}

/**
 * Places the order under Medusa's cart lock; a cart already an order
 * returns it. Any hosted form's verdict (PayTR's, iyzico's) of this shape.
 * A paid cart always becomes an order (adr/0026 Ek 2026-11-06): one the
 * shelf refuses is placed short of stock, for the shop to make good or
 * refund. One its own rules refuse is given back (`will_fail_again`), but
 * never once the cart is an order (read again after the failure: another
 * take may have placed it meanwhile); anything else is tried again with
 * the provider's next notice, and the shop is told when the shelf refuses
 * it even so, or the notice has come many times. A failed read of the
 * cart throws: tried again, never given back.
 */
export async function completePaidCart(
  container: MedusaContainer,
  verdict: Complete
): Promise<PaidCartCompletion> {
  const before = await placedOrderOfCart(container, verdict.cart_id)
  if (before) {
    return answeredBefore(container, verdict, before)
  }
  const { result, errors } = await completeCartWorkflow(container).run({
    input: { id: verdict.cart_id },
    throwOnError: false,
  })
  let error: unknown = errors[0]?.error
  if (!error) {
    return { order_id: result.id, will_fail_again: false }
  }
  // Whatever the error says, a cart that is an order now is never given back
  const since = await placedOrderOfCart(container, verdict.cart_id)
  if (since) {
    logger.warn({
      event: "payments.completion_failed_after_order",
      cartId: verdict.cart_id,
      err: errorSummary(error),
    })
    return answeredBefore(container, verdict, since)
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
      return { order_id: backorder.result.order_id, will_fail_again: false }
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
  // Read once more after the shelf's try: an order placed by any take is never given back
  const last = await placedOrderOfCart(container, verdict.cart_id)
  if (last) {
    return answeredBefore(container, verdict, last)
  }
  logger.warn({
    event: "payments.completion_refused",
    cartId: verdict.cart_id,
    err: errorSummary(error),
  })
  return { order_id: null, will_fail_again: true }
}

export const completePaidCartStep = createStep(
  "payments-complete-paid-cart",
  async (verdict: PaymentVerdict, { container }) =>
    new StepResponse<PaidCartCompletion>(
      verdict.kind === "complete"
        ? await completePaidCart(container, verdict)
        : { order_id: null, will_fail_again: false }
    )
)
