import { model } from "@medusajs/framework/utils"

/**
 * A product a customer keeps for later (F10.4, adr/0037 §4): the product,
 * and the variant when they picked one ("" when any). Signed-in customers
 * only; a guest's list stays in the storefront until they sign in.
 */
export const WishlistItem = model
  .define("wishlist_item", {
    id: model.id({ prefix: "wish" }).primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
    /** "" for the product as a whole: one spelling, so the pair stays unique. */
    variant_id: model.text().default(""),
  })
  .indexes([
    {
      on: ["customer_id", "product_id", "variant_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    { on: ["product_id"], where: "deleted_at IS NULL" },
  ])
