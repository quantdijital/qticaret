import type { MedusaContainer } from "@medusajs/framework/types"
import { ConflictError } from "../../lib/errors"
import { kurus } from "../../lib/money"
import { cancelRefundReference, isCancelRefundReference } from "../../lib/orders/locks"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { readOrderMoney } from "./order-money"
import { refundOrderWorkflow } from "./refund-order"
import { refundTraceOf } from "./refund-trace"
import { paymentRemainders } from "./steps/order-refund"

export interface CancelRefundInput {
  order_id: string
  note: string
  created_by: string | null
}

const settled = new Set(["made", "shown"])

/**
 * The order's refunds still open, before a cancel plans its own (security
 * review 2026-11-17, Y1 c): a cancel's, from a try before, is tried again
 * under its own reference (made once); another one is closed when its
 * money is surely back (recorded, or shown by the provider), and the
 * cancel waits while it is not (`orders.refund_unsettled`): its money is
 * neither counted as given back nor given back a second time.
 */
async function settleOpenRefunds(
  container: MedusaContainer,
  input: CancelRefundInput
): Promise<void> {
  const open = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .listOrderRefunds(
      { order_id: input.order_id, status: "pending" },
      {
        select: ["reference", "payment_id", "amount", "provider_parts"],
        order: { created_at: "ASC" },
      }
    )
  for (const entry of open) {
    if (!isCancelRefundReference(entry.reference)) {
      const { trace } = await refundTraceOf(container, {
        reference: entry.reference,
        payment_id: entry.payment_id,
        amount: entry.amount,
        parts: (entry.provider_parts as { amount: number; state: string }[] | null) ?? [],
      })
      if (!settled.has(trace)) {
        throw new ConflictError("orders.refund_unsettled")
      }
    }
    await refundOrderWorkflow(container).run({
      input: {
        order_id: input.order_id,
        reference: entry.reference,
        request: { amount: kurus(entry.amount) },
        payment_id: entry.payment_id,
        note: input.note,
        created_by: input.created_by,
      },
    })
  }
}

/**
 * A cancel's money back (F5 V5): what is still open settled first, then
 * one refund per payment with money left, each under the payment's own
 * reference (`cancelRefundReference`): a cancel tried again refunds each
 * payment once, whichever were refunded before. A hosted form's first.
 */
export async function refundForCancel(
  container: MedusaContainer,
  input: CancelRefundInput
): Promise<number> {
  await settleOpenRefunds(container, input)
  let left = (await readOrderMoney(container, input.order_id)).refundable
  let made = 0
  for (const payment of await paymentRemainders(container, input.order_id)) {
    const amount = Math.min(left, payment.remaining)
    if (amount <= 0) {
      continue
    }
    await refundOrderWorkflow(container).run({
      input: {
        order_id: input.order_id,
        reference: cancelRefundReference(payment.id),
        request: { amount: kurus(amount) },
        payment_id: payment.id,
        note: input.note,
        created_by: input.created_by,
      },
    })
    left = kurus(left - amount)
    made += 1
  }
  return made
}
