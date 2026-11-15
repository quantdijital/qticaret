import { model } from "@medusajs/framework/utils"

/**
 * A wholesale level (ADR-0068 §1): its own Medusa customer group and an
 * `override` price list for that group (Ek 2026-11-15), whose rows the
 * module writes: a rate off every variant's own price, and prices entered
 * by hand (`wholesale_manual_price`). Medusa ids are kept as text, as the
 * segments keep their group.
 */
export const WholesaleTier = model
  .define("wholesale_tier", {
    id: model.id({ prefix: "wtier" }).primaryKey(),
    name: model.text(),
    customer_group_id: model.text(),
    price_list_id: model.text(),
    /** Off every variant's own price, in basis points (20% = 2000); null: hand-entered prices only. */
    rate_bps: model.number().nullable(),
    /** Fewest units an order of the level's wholesalers holds; null: no rule. */
    min_quantity: model.number().nullable(),
    /** When the list was last asked to be written again (a new rate, the nightly run). */
    sync_requested_at: model.dateTime().nullable(),
    /** When the last full write that covered such a request started. */
    synced_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
  })
  .indexes([
    { on: ["name"], unique: true, where: "deleted_at IS NULL" },
    { on: ["customer_group_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["price_list_id"], unique: true, where: "deleted_at IS NULL" },
  ])
