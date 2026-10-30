import { model } from "@medusajs/framework/utils"

/**
 * A staff member's note on an order (F12.8): what the team should know
 * that the order does not say (a call, a promise, a warning). Seen only in
 * the panel, never by the shopper. Written once; its author or an owner
 * removes it: its text goes, the row stays with who removed it.
 */
export const OrderNote = model
  .define("order_note", {
    id: model.id({ prefix: "onote" }).primaryKey(),
    order_id: model.text(),
    /** The staff user who wrote it. */
    author_id: model.text(),
    body: model.text(),
    removed_by: model.text().nullable(),
  })
  .indexes([{ on: ["order_id", "created_at"], where: "deleted_at IS NULL" }])
