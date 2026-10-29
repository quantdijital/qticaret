import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendPurchaseConversionsWorkflow } from "../workflows/conversions/send"

/** A purchase told to Meta and GA4, as the shopper allowed at checkout (F10.9, adr/0038 §4). */
export default async function purchaseConversions({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await sendPurchaseConversionsWorkflow(container).run({ input: { order_id: data.id } })
}

export const config: SubscriberConfig = { event: "order.placed" }
