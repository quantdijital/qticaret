import { model } from "@medusajs/framework/utils"

/**
 * A customer's question about a product (F10.10, adr/0037 §4): asked from
 * a confirmed account, shown once the shop approves it.
 */
export const ProductQuestion = model
  .define("product_question", {
    id: model.id({ prefix: "pq" }).primaryKey(),
    product_id: model.text(),
    customer_id: model.text(),
    author_name: model.text(),
    body: model.text(),
    status: model.enum(["pending", "approved", "rejected"]).default("pending"),
    has_link: model.boolean().default(false),
    /** Approved answers: what the storefront and QAPage's `answerCount` show. */
    answer_count: model.number().default(0),
    moderated_by: model.text().nullable(),
    moderated_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["product_id", "status"], where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
  ])
