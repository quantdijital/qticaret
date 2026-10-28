import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendMessageWorkflow } from "../workflows/messaging/send-message"

/** "Siparişiniz alındı" to the customer (F9.4): card, bank transfer awaited, or paid at the door. */
export default async function orderPlacedMessage({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await sendMessageWorkflow(container).run({
    input: { template: "order.placed", resource_id: data.id },
  })
}

export const config: SubscriberConfig = { event: "order.placed" }
