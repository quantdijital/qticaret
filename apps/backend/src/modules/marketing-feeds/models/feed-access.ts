import { model } from "@medusajs/framework/utils"

/**
 * The token in the shop's feed addresses (F10.8, adr/0038 §3): one at a
 * time. Kept as a keyed hash to check a request against, and encrypted so
 * the panel can show the addresses again; turning feeds off removes it.
 */
export const FeedAccess = model.define("feed_access", {
  id: model.id({ prefix: "feedacc" }).primaryKey(),
  token_hash: model.text(),
  token_encrypted: model.text(),
})
