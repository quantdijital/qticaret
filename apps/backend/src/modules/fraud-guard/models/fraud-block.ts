import { model } from "@medusajs/framework/utils"

export const BLOCK_KINDS = ["email", "email_domain", "phone", "ip"] as const

/**
 * One entry of the shop's block list (F15.6, adr/0044 §4). `match` is what
 * a request is compared with: an e-mail or a phone as its keyed hash (never
 * the value), a domain or an IP address as written. `display` is what
 * staff see: masked for an e-mail or a phone. Until `expires_at`, or for good.
 */
export const FraudBlock = model
  .define("fraud_block", {
    id: model.id({ prefix: "frblk" }).primaryKey(),
    kind: model.enum([...BLOCK_KINDS]),
    match: model.text(),
    display: model.text(),
    reason: model.text().nullable(),
    created_by: model.text().nullable(),
    expires_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["kind", "match"], unique: true, where: "deleted_at IS NULL" }])
