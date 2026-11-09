import { model } from "@medusajs/framework/utils"

/**
 * A customer's review of a product they received (F10.6, adr/0037 §4).
 * Every review waits for the shop before the storefront shows it; a
 * changed one waits again. One per customer and product. One brought
 * from the shop's old platform (F14, adr/0042) has no order here, and a
 * customer only when its author moved too: it is not a purchase verified
 * here, and the storefront says so.
 */
export const ProductReview = model
  .define("product_review", {
    id: model.id({ prefix: "prev" }).primaryKey(),
    product_id: model.text(),
    customer_id: model.text().nullable(),
    /** The order the product was received with: the proof of purchase; none for one migrated. */
    order_id: model.text().nullable(),
    origin: model.enum(["storefront", "migration"]).default("storefront"),
    /** A migrated one's source and key there: written once, however often its run is. */
    source_ref: model.text().nullable(),
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
    /**
     * The shop's public reply under the review (plain text, at most 1,000
     * characters): written to an approved one, shown with it. The shop's
     * words, never the customer's: an erased author leaves it as it is.
     */
    reply: model.text().nullable(),
    /** The staff member who wrote the reply as it is now. */
    replied_by: model.text().nullable(),
    replied_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["product_id", "customer_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["product_id", "status"], where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
    { on: ["source_ref"], unique: true, where: "deleted_at IS NULL AND source_ref IS NOT NULL" },
  ])
