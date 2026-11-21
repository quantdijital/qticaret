import { model } from "@medusajs/framework/utils"

/**
 * A question about a product (F10.10, adr/0037 §4): a customer's, asked
 * from a confirmed account and shown once the shop approves it, or one the
 * shop wrote with its answer (adr/0074 §5 madde 4, the product's FAQ),
 * shown at once under the shop's name.
 */
export const ProductQuestion = model
  .define("product_question", {
    id: model.id({ prefix: "pq" }).primaryKey(),
    product_id: model.text(),
    author_kind: model.enum(["customer", "shop"]).default("customer"),
    /** The customer who asked; none for the shop's own question. */
    customer_id: model.text().nullable(),
    /** The staff member who added the shop's own question. */
    user_id: model.text().nullable(),
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
