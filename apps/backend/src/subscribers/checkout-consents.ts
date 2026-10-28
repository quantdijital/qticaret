import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { recordCheckoutConsentsWorkflow } from "../workflows/messaging/checkout-consents"

/** The consent boxes ticked at checkout become the order's recipients' consents (adr/0038 §2). */
export default async function checkoutConsents({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await recordCheckoutConsentsWorkflow(container).run({ input: { order_id: data.id } })
}

export const config: SubscriberConfig = { event: "order.placed" }
