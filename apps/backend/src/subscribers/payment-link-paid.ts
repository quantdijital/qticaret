import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { markPaymentLinkPaidWorkflow } from "../workflows/payment-links/paid"

/** An order from a payment link's cart closes the link as paid (adr/0051 §5). */
export default async function paymentLinkPaid({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await markPaymentLinkPaidWorkflow(container).run({ input: { order_id: data.id } })
}

export const config: SubscriberConfig = { event: "order.placed" }
