import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, cancelOrderWorkflow, releaseLockStep } from "@medusajs/medusa/core-flows"
import { bankTransferLockKey } from "../../lib/payments/bank-transfer"
import { readExpiredBankTransferStep } from "./steps/bank-transfer"

/**
 * Cancels a bank transfer order whose time to pay ran out (F6 W2,
 * adr/0029), through Medusa's own cancel, which gives its stock back.
 * Under the lock the confirmation and the panel's cancel take: an order
 * confirmed or cancelled meanwhile is read again and left alone.
 */
export const expireBankTransferWorkflow = createWorkflow(
  "payments-expire-bank-transfer",
  (input: { order_id: string; now: string }) => {
    const lockKey = transform({ input }, ({ input }) => bankTransferLockKey(input.order_id))
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 60 })
    const check = readExpiredBankTransferStep(input)
    when("payments-bank-transfer-expired", { check }, ({ check }) => check.expired).then(() => {
      cancelOrderWorkflow.runAsStep({ input: { order_id: input.order_id } })
    })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(check)
  }
)
