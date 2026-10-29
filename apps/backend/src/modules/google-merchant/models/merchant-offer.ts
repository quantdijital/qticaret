import { model } from "@medusajs/framework/utils"

/**
 * A product the shop's Merchant Center holds from us (F10 M13), with a
 * hash of what was sent: unchanged items are not sent again, and items no
 * longer sold are removed there.
 */
export const MerchantOffer = model
  .define("merchant_offer", {
    id: model.id({ prefix: "moffer" }).primaryKey(),
    offer_id: model.text(),
    input_hash: model.text(),
  })
  .indexes([{ on: ["offer_id"], unique: true, where: "deleted_at IS NULL" }])
