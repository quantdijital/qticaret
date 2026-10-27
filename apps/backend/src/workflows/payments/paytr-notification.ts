import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  claimPaytrNotificationStep,
  findPaytrSessionStep,
  markPaytrNotificationStep,
} from "./steps/paytr-notification"
import type { PaytrNotification } from "./steps/paytr-notification"
import {
  checkPaytrPaymentStep,
  completePaidCartStep,
  recordPaytrOrphanStep,
} from "./steps/paytr-payment-check"

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
    const recoveryId = recordPaytrOrphanStep({ notification: input, verdict, completion })
    markPaytrNotificationStep({
      claim,
      order_id: transform({ completion }, ({ completion }) => completion.order_id),
      recovery_id: recoveryId,
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
