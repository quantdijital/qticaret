import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  refundPaymentWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { toMedusaAmount } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import {
  closeRefundEntryStep,
  namePendingRefundStep,
  openRefundEntryStep,
  planOrderRefundStep,
} from "./steps/order-refund"
import type { RefundOrderInput } from "./steps/order-refund"

/**
 * Gives money back on an order, line by line (F5 V5, adr/0010), under the
 * order's own refund lock. The amount comes from the order's shares and
 * the ledger, never from the request; the refund itself is Medusa's
 * (`refundPaymentWorkflow`), which asks the provider. Tried again with the
 * same reference, a refund is made once: the provider is given that
 * reference, and one already made is only reported.
 */
export const refundOrderWorkflow = createWorkflow(
  "orders-refund-order",
  (input: RefundOrderInput) => {
    const lockKey = transform({ input }, ({ input }) => `orders:refund:${input.order_id}`)
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })
    const plan = planOrderRefundStep(input)
    const entryId = openRefundEntryStep({ order: input, plan })
    namePendingRefundStep({ plan, reference: input.reference })
    when("orders-refund-payment", { plan }, ({ plan }) => !plan.done).then(() => {
      refundPaymentWorkflow.runAsStep({
        input: transform({ input, plan }, ({ input, plan }) => ({
          payment_id: plan.payment_id,
          amount: toMedusaAmount(plan.amount as Kurus),
          ...(input.created_by ? { created_by: input.created_by } : {}),
          ...(input.note ? { note: input.note } : {}),
        })),
      })
    })
    closeRefundEntryStep({ entry_id: entryId, plan })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(
      transform({ input, plan }, ({ input, plan }) => ({
        reference: input.reference,
        amount: plan.amount,
        lines: plan.lines,
        made_before: plan.done,
      }))
    )
  }
)
