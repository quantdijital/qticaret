import { model } from "@medusajs/framework/utils"

/**
 * An event sent, or tried, to Meta or GA4 (F10.9): once per order and
 * kind, a refund once per refund. No personal data: what went, when, and
 * what the provider said.
 */
export const ConversionEvent = model
  .define("conversion_event", {
    id: model.id({ prefix: "convev" }).primaryKey(),
    /** `<target>:<kind>:<order or refund id>`. */
    event_key: model.text(),
    target: model.text(),
    kind: model.text(),
    order_id: model.text(),
    /** A refund's amount in kuruş, to send it again; null for a purchase or a whole order. */
    amount: model.number().nullable(),
    /** pending: claimed by the delivery sending it now. */
    status: model.enum(["pending", "sent", "failed"]),
    attempts: model.number().default(0),
    error: model.text().nullable(),
    sent_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["event_key"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status", "created_at"], where: "deleted_at IS NULL" },
  ])
