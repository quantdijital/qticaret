import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { keepOrderContractsWorkflow } from "../workflows/legal/order-copies"

/** The contracts accepted at checkout, kept with the order as it was placed (adr/0041 §2). */
export default async function orderContracts({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await keepOrderContractsWorkflow(container).run({ input: { order_id: data.id } })
}

export const config: SubscriberConfig = { event: "order.placed" }
