import { model } from "@medusajs/framework/utils"

/** Why a stock level moved (adr/0020); `unknown` when nothing tells. */
export const MOVEMENT_REASONS = [
  "manual",
  "import",
  "bulk_edit",
  "order",
  "return",
  "cancel",
  "reconcile",
  "unknown",
] as const

/**
 * One change of an item's stock at a location (F3.8, adr/0020): what was on
 * the shelf and what was held for orders, before and after, why, and who or
 * what did it when that is known. Append-only: a correction is a new row.
 */
export const StockMovement = model
  .define("stock_movement", {
    id: model.id({ prefix: "stmv" }).primaryKey(),
    // The order rows were written in: clocks of two processes may disagree
    seq: model.autoincrement(),
    inventory_item_id: model.text(),
    location_id: model.text(),
    delta_stocked: model.number(),
    stocked_after: model.number(),
    delta_reserved: model.number(),
    reserved_after: model.number(),
    reason: model.enum([...MOVEMENT_REASONS]),
    // An order, a job or an import the change came from
    reference: model.text().nullable(),
    actor_id: model.text().nullable(),
  })
  .indexes([
    { on: ["inventory_item_id", "location_id", "seq"] },
    { on: ["inventory_item_id", "seq"] },
  ])
