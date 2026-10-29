import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { RETURN_REFUNDED } from "../workflows/returns/receive-return"
import { sendRefundConversionWorkflow } from "../workflows/conversions/send"

interface RefundData {
  id: string
  /** A return's refund (`return.refunded`); none on a cancellation. */
  order_id?: string
  amount?: number
}

/**
 * A refund told to GA4 (F10.9): a return's refunded amount, or the whole
 * order when it is cancelled. Meta has no refund event.
 */
export default async function refundConversions({
  event: { name, data },
  container,
}: SubscriberArgs<RefundData>) {
  const cancelled = name === "order.canceled"
  await sendRefundConversionWorkflow(container).run({
    input: cancelled
      ? { order_id: data.id, refund_id: `cancel-${data.id}`, amount: null }
      : { order_id: data.order_id ?? "", refund_id: data.id, amount: data.amount ?? null },
  })
}

export const config: SubscriberConfig = { event: [RETURN_REFUNDED, "order.canceled"] }
