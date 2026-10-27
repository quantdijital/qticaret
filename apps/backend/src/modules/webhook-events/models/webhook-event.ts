import { model } from "@medusajs/framework/utils"

/**
 * A notification a provider sent (adr/0026 §5; docs/04 `processed_webhooks`):
 * one record per provider and event, so a repeated notification is
 * recognised and never handled twice. The summary carries references and
 * amounts only, nothing personal.
 */
export const WebhookEvent = model
  .define("webhook_event", {
    id: model.id({ prefix: "whev" }).primaryKey(),
    provider: model.text(),
    /** The provider's own key for the event, e.g. PayTR's `merchant_oid:status`. */
    event_key: model.text(),
    status: model.enum(["processing", "processed", "failed"]).default("processing"),
    attempts: model.number().default(1),
    summary: model.json().nullable(),
    error_code: model.text().nullable(),
    processed_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["provider", "event_key"], unique: true }, { on: ["created_at"] }])
