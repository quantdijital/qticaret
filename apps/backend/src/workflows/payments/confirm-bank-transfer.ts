import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { authorizePaymentSessionStep, capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { bankTransferLockKey } from "../../lib/payments/bank-transfer"
import { markBankTransferConfirmedStep, readBankTransferOrderStep } from "./steps/bank-transfer"
import { acquireLocksStep } from "../locking/acquire-locks"
import { releaseLocksStep } from "../locking/release-locks"

export interface ConfirmBankTransferInput {
  order_id: string
  /** The staff member who saw the money come in. */
  confirmed_by: string
}

/**
 * The shop saw a bank transfer's money come in (F6 W2, adr/0029): the
 * session is marked confirmed, authorized again (the provider now says
 * so) and captured, which records the order's transaction. Under the
 * order's lock; an order already paid is only reported, a cancelled one
 * refused.
 */
export const confirmBankTransferWorkflow = createWorkflow(
  "payments-confirm-bank-transfer",
  (input: ConfirmBankTransferInput) => {
    const lockKey = transform({ input }, ({ input }) => bankTransferLockKey(input.order_id))
    const held = acquireLocksStep({ key: lockKey, timeout: 10, ttl: 60 })
    const order = readBankTransferOrderStep(input.order_id)
    markBankTransferConfirmedStep(order)
    when("payments-bank-transfer-capture", { order }, ({ order }) => !order.done).then(() => {
      const payment = authorizePaymentSessionStep(
        transform({ order }, ({ order }) => ({
          id: order.done ? "" : order.session_id,
          context: {},
        }))
      )
      capturePaymentWorkflow.runAsStep({
        input: transform({ payment, input }, ({ payment, input }) => ({
          payment_id: payment?.id ?? "",
          captured_by: input.confirmed_by,
        })),
      })
    })
    releaseLocksStep(held)
    return new WorkflowResponse(
      transform({ order, input }, ({ order, input }) => ({
        order_id: input.order_id,
        made_before: order.done,
      }))
    )
  }
)
