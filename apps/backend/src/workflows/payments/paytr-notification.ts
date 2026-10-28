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
  claimPaytrNotificationStep,
  findPaytrSessionStep,
  markPaytrNotificationStep,
} from "./steps/paytr-notification"
import type { PaytrNotification } from "./steps/paytr-notification"
import { recordPaymentOrphanStep } from "./steps/payment-orphan"
import { completePaidCartStep } from "./steps/complete-paid-cart"
import { checkPaytrPaymentStep } from "./steps/paytr-payment-check"

/** `ok`: answer "OK". Anything else gets no "OK", and PayTR sends the notification again. */
export type PaytrNotificationAnswer = "ok" | "busy" | "not_ours"

/**
 * A genuine PayTR notification (the route checked its signature), handled
 * once (adr/0026 §5, §6). PayTR is asked again first: a payment it does
 * not show yet is left for its next try. A payment that matches its
 * session completes the cart under Medusa's cart lock; a completed cart
 * returns its order, so a repeat never opens a second one. A payment that
 * cannot become an order (its session gone, an amount that differs, a
 * cart that can no longer be completed) is recorded to be given back, and
 * answered "OK": PayTR refunds only acknowledged payments. A failed
 * payment changes nothing: the cart can be paid again.
 */
export const paytrNotificationWorkflow = createWorkflow(
  "payments-paytr-notification",
  (input: PaytrNotification) => {
    const target = findPaytrSessionStep(input.merchant_oid)
    const claim = claimPaytrNotificationStep({ notification: input, target })
    const verdict = checkPaytrPaymentStep({ notification: input, target, claim })
    const completion = completePaidCartStep(verdict)
    const recoveryId = recordPaymentOrphanStep({
      provider: "paytr",
      reference: input.merchant_oid,
      verdict,
      completion,
    })
    markPaytrNotificationStep({
      claim,
      order_id: transform({ completion }, ({ completion }) => completion.order_id),
      recovery_id: recoveryId,
    })
    // The shopper's message, from the notification's first handling only (F9)
    when(
      "payments-paytr-failed",
      { input, claim, target },
      ({ input, claim, target }) =>
        input.status === "failed" && claim.state === "new" && target?.orphan === false
    ).then(() => {
      emitEventStep({
        eventName: PAYMENT_FAILED,
        data: transform({ target }, ({ target }): PaymentFailedEvent => ({
          cart_id: target?.orphan === false ? target.cart_id : "",
          provider: "paytr",
        })),
      })
    })
    return new WorkflowResponse(
      transform({ claim }, ({ claim }): PaytrNotificationAnswer => {
        if (claim.state === "not_ours" || claim.state === "busy") {
          return claim.state
        }
        return "ok"
      })
    )
  }
)
