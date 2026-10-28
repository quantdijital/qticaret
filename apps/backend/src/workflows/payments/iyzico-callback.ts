import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { PAYMENT_FAILED } from "./events"
import type { PaymentFailedEvent } from "./events"
import {
  checkIyzicoPaymentStep,
  closePaymentFormStep,
  findIyzicoSessionStep,
} from "./steps/iyzico-callback"
import type { IyzicoForm, IyzicoOutcome } from "./steps/iyzico-callback"
import { recordPaymentOrphanStep } from "./steps/payment-orphan"
import { completePaidCartStep } from "./steps/complete-paid-cart"

export interface IyzicoCallbackResult {
  outcome: IyzicoOutcome
  /** Where the session sends the shopper back; null when the session is gone or not ours. */
  return_urls: { success: string; failure: string } | null
  order_id: string | null
}

/**
 * A checkout form's result (adr/0026 §4–§6), from iyzico's callback or the
 * reconcile job. The token proves nothing alone: iyzico is asked for the
 * form's result and its signature checked. A payment that matches its
 * session and passed the fraud check completes the cart under Medusa's
 * cart lock; a completed cart returns its order, so a repeat (a refreshed
 * page, the job) never opens a second one. A payment that cannot become an
 * order is recorded to be given back, for good: a later callback or the
 * job never makes it an order. The form's record (`payment-forms`) closes
 * once nothing more can come of it. No event record as PayTR's: iyzico
 * does not resend a callback.
 */
export const iyzicoCallbackWorkflow = createWorkflow(
  "payments-iyzico-callback",
  (input: IyzicoForm) => {
    const target = findIyzicoSessionStep(input)
    const check = checkIyzicoPaymentStep(target)
    const verdict = transform({ check }, ({ check }) => check.verdict)
    const completion = completePaidCartStep(verdict)
    recordPaymentOrphanStep({
      provider: "iyzico",
      // iyzico's own payment id, from its signed answer (the refund asks by it, F5 V10)
      reference: transform({ check }, ({ check }) => check.payment_id ?? ""),
      verdict,
      completion,
    })
    const outcome = transform({ check, completion }, ({ check, completion }): IyzicoOutcome =>
      // A paid cart that cannot complete is given back: not an order
      check.outcome === "paid" && !completion.order_id ? "orphan" : check.outcome
    )
    closePaymentFormStep({ session_id: input.session_id, outcome })
    // The shopper's message; a repeated callback is sent once a day (F9)
    when(
      "payments-iyzico-failed",
      { outcome, target },
      ({ outcome, target }) => outcome === "failed" && target?.orphan === false
    ).then(() => {
      emitEventStep({
        eventName: PAYMENT_FAILED,
        data: transform({ target }, ({ target }): PaymentFailedEvent => ({
          cart_id: target?.orphan === false ? target.cart_id : "",
          provider: "iyzico",
        })),
      })
    })
    return new WorkflowResponse(
      transform(
        { outcome, target, completion },
        ({ outcome, target, completion }): IyzicoCallbackResult => ({
          outcome,
          return_urls: target && !target.orphan ? target.return_urls : null,
          order_id: completion.order_id,
        })
      )
    )
  }
)
