import { model } from "@medusajs/framework/utils"

/**
 * A customer's review of a product they received (F10.6, adr/0037 §4).
 * Every review waits for the shop before the storefront shows it; a
 * changed one waits again. One per customer and product.
 */
export const ProductReview = model
  .define("product_review", {
    id: model.id({ prefix: "prev" }).primaryKey(),
    product_id: model.text(),
    customer_id: model.text(),
    /** The order the product was received with: the proof of purchase. */
    order_id: model.text(),
    /** 1 to 5. */
    rating: model.number(),
    title: model.text().nullable(),
    body: model.text(),
    /** As the storefront names the author: first name and an initial. */
    author_name: model.text(),
    status: model.enum(["pending", "approved", "rejected"]).default("pending"),
    /** Whether the text reads as a link or an address: the shop looks twice. */
    has_link: model.boolean().default(false),
    reject_reason: model.text().nullable(),
    moderated_by: model.text().nullable(),
    moderated_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["product_id", "customer_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["product_id", "status"], where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
  ])
