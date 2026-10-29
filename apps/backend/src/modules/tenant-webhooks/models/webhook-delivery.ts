import { model } from "@medusajs/framework/utils"

/**
 * One event sent to one subscription (F11.7): once per event (`event_id`),
 * tried again later and later until it is answered 2xx. The log keeps the
 * answer's status, the time it took and a code; never a body of either side.
 */
export const WebhookDelivery = model
  .define("webhook_delivery", {
    id: model.id({ prefix: "whdel" }).primaryKey(),
    subscription_id: model.text(),
    event: model.text(),
    /** The event's own key: the same event twice is one delivery. */
    event_id: model.text(),
    /** What is sent: records and numbers, nothing personal. */
    payload: model.json(),
    status: model.enum(["pending", "delivered", "stopped"]).default("pending"),
    attempts: model.number().default(0),
    next_attempt_at: model.dateTime(),
    last_status: model.number().nullable(),
    last_duration_ms: model.number().nullable(),
    last_error: model.text().nullable(),
    delivered_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["subscription_id", "event_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status", "next_attempt_at"] },
  ])
