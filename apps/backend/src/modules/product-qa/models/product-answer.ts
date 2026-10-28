import { model } from "@medusajs/framework/utils"

/**
 * An answer to a product question: the shop's, shown at once, or a
 * customer's who received the product, shown once the shop approves it.
 */
export const ProductAnswer = model
  .define("product_answer", {
    id: model.id({ prefix: "pans" }).primaryKey(),
    question_id: model.text(),
    product_id: model.text(),
    author_kind: model.enum(["shop", "customer"]),
    customer_id: model.text().nullable(),
    /** The staff member who answered for the shop. */
    user_id: model.text().nullable(),
    author_name: model.text(),
    body: model.text(),
    status: model.enum(["pending", "approved", "rejected"]).default("pending"),
    has_link: model.boolean().default(false),
    moderated_by: model.text().nullable(),
    moderated_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["question_id", "status"], where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
  ])
