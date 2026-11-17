import type { BigNumberInput } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { refusedOutright } from "../../../lib/payments/refund-refusal"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import type OrderRefundsModuleService from "../../../modules/order-refunds/service"
import { PROVIDER_REFUSED } from "../refund-settle"

// A failure as it came back from the workflow, an Error again: its fields (the key, the code) kept
const asError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error
  }
  const message = (error as { message?: unknown } | null)?.message
  return Object.assign(new Error(typeof message === "string" ? message : "refund failed"), error)
}

/**
 * Medusa's refund of the payment (`refundPaymentWorkflow`, which asks the
 * provider), run on its own: a refusal outright is written on the ledger
 * entry (`provider_refused`) before the failure undoes the workflow, so
 * the entry fails at once rather than waiting to be confirmed (review
 * 2026-11-17). Its own steps are not undone by a later failure of ours:
 * the money moves it wrote stand with the refund.
 */
export const sendRefundStep = createStep(
  "orders-send-refund",
  async (
    input: {
      entry_id: string
      payment_id: string
      amount: BigNumberInput
      created_by?: string
      note?: string
    },
    { container }
  ) => {
    const { entry_id, ...refund } = input
    const { errors } = await refundPaymentWorkflow(container).run({
      input: refund,
      throwOnError: false,
    })
    const error: unknown = errors[0]?.error
    if (error === undefined) {
      return new StepResponse(null)
    }
    if (refusedOutright(error)) {
      await container
        .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
        .updateOrderRefunds({ id: entry_id, error_code: PROVIDER_REFUSED })
    }
    throw asError(error)
  }
)
