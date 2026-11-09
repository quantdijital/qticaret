import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { logger } from "../../../lib/logging"
import { alertPaymentIssue } from "../issue-alert"
import type { PaymentVerdict } from "./payment-orphan"

/**
 * A payment the provider shows refunded before its order opened (security
 * review 2026-11-09): no order, no refund of ours on top; logged and the
 * shop told, once per reference. The notice is answered "OK".
 */
export const alertRefundedPaymentStep = createStep(
  "payments-alert-refunded",
  async (verdict: PaymentVerdict, { container }) => {
    if (verdict.kind !== "refunded") {
      return new StepResponse(false)
    }
    logger.warn({
      event: "payments.refunded_before_order",
      provider: verdict.provider,
      reference: verdict.reference,
      cartId: verdict.cart_id,
      refunded: verdict.refunded,
    })
    await alertPaymentIssue(container, {
      issue: "refunded_before_order",
      provider: verdict.provider,
      reference: verdict.reference,
      cart_id: verdict.cart_id,
      amount: verdict.amount,
    })
    return new StepResponse(true)
  }
)
