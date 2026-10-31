import { model } from "@medusajs/framework/utils"

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const

/**
 * An order the rules found suspicious (F15.6, adr/0044 §3), one per order:
 * its score and the rules that made it, as rule names and points only.
 * While pending the order is not shipped; staff approve it or reject it.
 */
export const FraudReview = model
  .define("fraud_review", {
    id: model.id({ prefix: "frrev" }).primaryKey(),
    order_id: model.text(),
    score: model.number(),
    reasons: model.json(),
    status: model.enum([...REVIEW_STATUSES]).default("pending"),
    decided_by: model.text().nullable(),
    decided_at: model.dateTime().nullable(),
    note: model.text().nullable(),
  })
  .indexes([
    { on: ["order_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
  ])
