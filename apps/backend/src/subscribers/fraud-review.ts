import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { notificationText } from "../lib/notifications/messages"
import { reviewOrderWorkflow } from "../workflows/fraud/review-order"

/**
 * A placed order is scored (F15.6, adr/0044 §3); one held for review rings
 * the panel's bell. A failure is logged, never the order's: it was placed.
 */
export default async function fraudReview({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const { result } = await reviewOrderWorkflow(container).run({ input: { order_id: data.id } })
    if (!result.review_id) {
      return
    }
    const { data: orders } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["display_id"],
      filters: { id: data.id },
    })
    const number = String((orders[0] as { display_id?: number } | undefined)?.display_id ?? "")
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: "orders.fraud_review",
      resource_id: data.id,
      resource_type: "order",
      idempotency_key: `orders.fraud_review:${data.id}`,
      data: {
        kind: "fraud_review",
        order_id: data.id,
        number,
        score: result.score,
        ...notificationText("orders.fraud_review", { number, score: String(result.score) }),
      },
    })
  } catch (error) {
    logger.error({ event: "fraud.review_failed", orderId: data.id, err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
