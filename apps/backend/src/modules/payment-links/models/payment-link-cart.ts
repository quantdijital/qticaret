import { model } from "@medusajs/framework/utils"

/**
 * A cart opened from a payment link, one row a cart (adr/0051 §3): the
 * link's carts are found here by the link's id, then read by their own
 * ids, never by a JSON key of Medusa's `cart` table (which has no index
 * for it, and stays Medusa's). Written when the link opens the cart; the
 * cart keeps its `qt_payment_link` mark as well. Ids only, no personal data.
 */
export const PaymentLinkCart = model
  .define("payment_link_cart", {
    id: model.id({ prefix: "plcart" }).primaryKey(),
    link_id: model.text(),
    cart_id: model.text(),
  })
  // A cart is one link's (cart_id unique); the pair's index also finds a link's carts
  .indexes([
    { on: ["link_id", "cart_id"], unique: true },
    { on: ["cart_id"], unique: true },
  ])
