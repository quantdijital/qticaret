import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderMessageWorkflow } from "../workflows/messaging/send-order-message"

/** "Siparişiniz alındı" to the customer (F9.4): card, bank transfer awaited, or paid at the door. */
export default async function orderPlacedMessage({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await sendOrderMessageWorkflow(container).run({
    input: { order_id: data.id, template: "order.placed" },
  })
}

export const config: SubscriberConfig = { event: "order.placed" }
