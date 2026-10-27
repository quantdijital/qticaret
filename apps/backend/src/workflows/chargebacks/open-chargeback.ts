import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { createChargebackStep, readDisputedPaymentStep } from "./steps/chargeback"
import type { OpenChargebackInput } from "./steps/chargeback"

/**
 * Records a cardholder's dispute of an order's payment (F6.7, adr/0030),
 * from the provider's notice: against the order's captured payment, for no
 * more than it took, one open at a time.
 */
export const openChargebackWorkflow = createWorkflow(
  "chargebacks-open",
  (input: OpenChargebackInput) => {
    const payment = readDisputedPaymentStep(input)
    const chargeback = createChargebackStep(
      transform({ input, payment }, ({ input, payment }) => ({ ...input, ...payment }))
    )
    return new WorkflowResponse(chargeback)
  }
)
