import { model } from "@medusajs/framework/utils"

/**
 * The one reminder a cart left behind gets (F10.7, adr/0038 §1), kept
 * here and not on the cart: a shopper can write the cart's metadata, and
 * any write to the cart moves its `updated_at`. The return link's token is
 * kept only as a hash, and cleared once it opens the cart.
 */
export const CartReminder = model
  .define("cart_reminder", {
    id: model.id({ prefix: "cartrem" }).primaryKey(),
    cart_id: model.text(),
    /** What the send came to: pending until it is tried, then deliver()'s outcome. */
    outcome: model.text(),
    token_hash: model.text().nullable(),
    expires_at: model.dateTime().nullable(),
    /** When the link brought the shopper back to the cart. */
    returned_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["cart_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["token_hash"], where: "deleted_at IS NULL AND token_hash IS NOT NULL" },
    { on: ["created_at"], where: "deleted_at IS NULL" },
  ])
