import type { MedusaContainer } from "@medusajs/framework/types"
import { kurus } from "../../lib/money"
import { cancelRefundReference } from "../../lib/orders/locks"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { readOrderMoney } from "./order-money"
import { refundOrderWorkflow } from "./refund-order"
import { paymentRemainders } from "./steps/order-refund"

export interface CancelRefundInput {
  order_id: string
  note: string
  created_by: string | null
}

/**
 * The order's refunds still open, before a cancel plans its own (security
 * review 2026-11-17, Y1 c, O1): each tried again under its own reference,
 * a cancel's from a try before as any other. The refund's plan closes one
 * whose money is surely back (recorded, or shown by the provider) and
 * refuses the rest (`orders.refund_unsettled`): the cancel waits, its
 * money neither counted as given back nor sent a second time.
 */
async function settleOpenRefunds(
  container: MedusaContainer,
  input: CancelRefundInput
): Promise<void> {
  const open = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .listOrderRefunds(
      { order_id: input.order_id, status: "pending" },
      { select: ["reference", "payment_id", "amount"], order: { created_at: "ASC" } }
    )
  for (const entry of open) {
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
