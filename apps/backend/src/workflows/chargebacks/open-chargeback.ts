import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { createChargebackStep, readDisputedPaymentStep } from "./steps/chargeback"
import type { OpenChargebackInput } from "./steps/chargeback"

/**
 * Records a cardholder's dispute of an order's payment (F6.7, adr/0030),
 * from the provider's notice: against the order's captured card payment,
 * for no more than it took, one open at a time. Under the order's lock,
 * so two records of the same notice do not both pass the check.
 */
export const openChargebackWorkflow = createWorkflow(
  "chargebacks-open",
  (input: OpenChargebackInput) => {
    const lockKey = transform({ input }, ({ input }) => `chargebacks:order:${input.order_id}`)
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })
    const payment = readDisputedPaymentStep(input)
    const chargeback = createChargebackStep(
      transform({ input, payment }, ({ input, payment }) => ({ ...input, ...payment }))
    )
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(chargeback)
  }
)
