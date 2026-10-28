import { model } from "@medusajs/framework/utils"

/**
 * "Tell me when it is back" for one variant (F10.5, adr/0037 §4). The
 * address is kept encrypted to write to it once, and as a keyed hash to
 * find it; a guest's alert waits for the address to confirm it.
 */
export const StockAlert = model
  .define("stock_alert", {
    id: model.id({ prefix: "stal" }).primaryKey(),
    variant_id: model.text(),
    product_id: model.text(),
    email_hash: model.text(),
    email_encrypted: model.text(),
    email_masked: model.text(),
    customer_id: model.text().nullable(),
    /** pending: a guest's, until the address confirms; notified: done, once. */
    status: model.enum(["pending", "active", "notified", "cancelled"]),
    /** A hash of the confirmation link's token; the token itself is only in the e-mail. */
    confirm_token_hash: model.text().nullable(),
    confirm_expires_at: model.dateTime().nullable(),
    notified_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["variant_id", "email_hash"], unique: true, where: "deleted_at IS NULL" },
    { on: ["variant_id", "status"], where: "deleted_at IS NULL" },
    { on: ["confirm_token_hash"], where: "deleted_at IS NULL" },
  ])
