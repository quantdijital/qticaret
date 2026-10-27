import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  claimPaytrNotificationStep,
  findPaytrSessionStep,
  markPaytrNotificationStep,
} from "./steps/paytr-notification"
import type { PaytrNotification } from "./steps/paytr-notification"

/** `ok`: answer "OK". Anything else gets no "OK", and PayTR sends the notification again. */
export type PaytrNotificationAnswer = "ok" | "busy" | "not_ours"

/**
 * A genuine PayTR notification (the route checked its signature), handled
 * once (adr/0026 §5). A successful payment completes the cart under
 * Medusa's cart lock; completion asks PayTR again (`authorizePayment`)
 * and compares the payment with the session. A failed payment changes
 * nothing: the cart can be paid again. A completed cart returns its order,
 * so a repeat never opens a second one.
 */
export const paytrNotificationWorkflow = createWorkflow(
  "payments-paytr-notification",
  (input: PaytrNotification) => {
    const target = findPaytrSessionStep(input.merchant_oid)
    const claim = claimPaytrNotificationStep({ notification: input, target })
    const order = when(
      "payments-paytr-complete-cart",
      { input, claim },
      ({ input, claim }) =>
        input.status === "success" && (claim.state === "new" || claim.state === "retry")
    ).then(() =>
      completeCartWorkflow.runAsStep({
        input: transform({ claim }, ({ claim }) => ({ id: claim.cart_id ?? "" })),
      })
    )
    markPaytrNotificationStep({
      claim,
      order_id: transform({ order }, ({ order }) => order?.id ?? null),
    })
    return new WorkflowResponse(
      transform({ claim }, ({ claim }): PaytrNotificationAnswer => {
        if (claim.state === "not_ours") {
          return "not_ours"
        }
        return claim.state === "busy" ? "busy" : "ok"
      })
    )
  }
)
