import { model } from "@medusajs/framework/utils"

/**
 * The team's note on a customer (2026-11-06): one text the shop keeps
 * about them (a preference, a call, a warning). Seen only in the panel,
 * never by the customer: not the customer's `metadata`, which the store
 * API returns to them. Emptied and removed with the customer's erasure.
 */
export const CustomerNote = model
  .define("customer_note", {
    id: model.id({ prefix: "cnote" }).primaryKey(),
    customer_id: model.text(),
    body: model.text(),
    /** The staff user who last wrote it. */
    updated_by: model.text().nullable(),
  })
  .indexes([{ on: ["customer_id"], unique: true, where: "deleted_at IS NULL" }])
