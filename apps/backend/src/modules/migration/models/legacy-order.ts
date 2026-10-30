import { model } from "@medusajs/framework/utils"

/**
 * An order from the shop's old platform (adr/0042 §4): shown on its
 * customer's page, never a live order here (no stock, invoice, accounting,
 * message or webhook follows from it). Its invoice was the old platform's.
 * Kept with its customer; erased with them (KVKK request) like an order's
 * personal fields.
 */
export const LegacyOrder = model
  .define("legacy_order", {
    id: model.id({ prefix: "lord" }).primaryKey(),
    source: model.text(),
    source_key: model.text(),
    number: model.text(),
    placed_at: model.dateTime(),
    currency_code: model.text(),
    total: model.bigNumber(),
    status: model.text(),
    customer_id: model.text().nullable(),
    /** The address the order went to, its e-mail: the customer's, erased with them. */
    email: model.text().nullable(),
    /** Title, SKU, quantity and line total: what was bought. */
    lines: model.json().default({}),
  })
  .indexes([
    { on: ["source", "source_key"], unique: true, where: "deleted_at IS NULL" },
    { on: ["customer_id"] },
  ])
