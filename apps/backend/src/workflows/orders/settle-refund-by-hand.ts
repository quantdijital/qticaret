import type { MedusaContainer, UpdatePaymentDTO } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { kurus, toMedusaAmount } from "../../lib/money"
import { orderRefundLockKey } from "../../lib/orders/locks"
import { refundRecordOf, withRefundRecord } from "../../lib/payments/pending-refund"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { dropPendingRefund } from "./steps/pending-refund"
import { restoreRefundTransaction } from "./steps/refund-transactions"

export interface SettleRefundByHandInput {
  order_id: string
  reference: string
  /** What the shop saw at the provider: the money went back, or it did not. */
  outcome: "made" | "not_made"
  actor_id: string
}

/** Checked at the provider by staff: the codes say so in the ledger (the audit log says who). */
export const CHECKED_MADE = "checked_made"
export const CHECKED_NOT_MADE = "checked_not_made"

// The payment module creates a refund record without a provider call (its generated method)
interface RefundRecords {
  createRefunds(data: {
    payment: string
    amount: ReturnType<typeof toMedusaAmount>
    created_by?: string
    note?: string
  }): Promise<{ id: string }>
}

/**
 * Medusa's record of a refund made outside its call (the provider's answer
 * lost, its refund deleted with the failure): created once, its id kept in
 * the payment's data as a provider records one, so the order's money move
 * and the payment's refunded total agree with the money gone.
 */
async function recordMadeRefund(
  container: Pick<MedusaContainer, "resolve">,
  entry: { payment_id: string; reference: string; amount: number },
  actorId: string
): Promise<void> {
  const payments = container.resolve(Modules.PAYMENT)
  const [payment] = await payments.listPayments(
    { id: entry.payment_id },
    { select: ["id", "data"] }
  )
  if (!payment || refundRecordOf(payment.data, entry.reference, entry.amount)) {
    return
  }
  const refund = await (payments as unknown as RefundRecords).createRefunds({
    payment: payment.id,
    amount: toMedusaAmount(kurus(entry.amount)),
    created_by: actorId,
    note: "refund checked at the provider",
  })
  const data = withRefundRecord(payment.data ?? {}, entry.reference, kurus(entry.amount), refund.id)
  await payments.updatePayment({
    id: payment.id,
    data: { refunds: data["refunds"] },
  } as unknown as UpdatePaymentDTO)
}

/**
 * A refund left open, checked by staff at the provider (review 2026-11-17,
 * O2): "made" closes it as done, with Medusa's refund record and the
 * order's money move written if missing; "not made" fails it, its lines
 * free again. Sends nothing. Only an open refund of this order; under the
 * order's refund lock (the workflow's).
 */
export async function settleRefundByHand(
  container: Pick<MedusaContainer, "resolve">,
  input: SettleRefundByHandInput
): Promise<{ reference: string; status: "done" | "failed" }> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const [entry] = await ledger.listOrderRefunds(
    { reference: input.reference },
    { select: ["id", "order_id", "reference", "payment_id", "amount", "status"], take: 1 }
  )
  if (entry?.order_id !== input.order_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.refund_unknown")
  }
  if (entry.status !== "pending") {
    throw new ValidationError("orders.refund_not_open")
  }
  if (input.outcome === "made") {
    await recordMadeRefund(container, entry, input.actor_id)
    await restoreRefundTransaction(container, entry)
  }
  const status = input.outcome === "made" ? "done" : "failed"
  await ledger.updateOrderRefunds({
    id: entry.id,
    status,
    error_code: input.outcome === "made" ? CHECKED_MADE : CHECKED_NOT_MADE,
  })
  await dropPendingRefund(container, entry.payment_id)
  logger.info({
    event: "orders.refund_checked",
    orderId: entry.order_id,
    reference: entry.reference,
    outcome: input.outcome,
  })
  return { reference: entry.reference, status }
}

export const settleRefundByHandStep = createStep(
  "orders-settle-refund-by-hand",
  async (input: SettleRefundByHandInput, { container }) =>
    new StepResponse(await settleRefundByHand(container, input))
)

export const settleRefundByHandWorkflow = createWorkflow(
  "orders-settle-refund-by-hand",
  (input: SettleRefundByHandInput) => {
    const lockKey = transform({ input }, ({ input }) => orderRefundLockKey(input.order_id))
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })
    const settled = settleRefundByHandStep(input)
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(settled)
  }
)
