import { model } from "@medusajs/framework/utils"

/**
 * How an item's low stock is watched (F3.8, adr/0020): its own threshold
 * when the shop set one (else the shop's default), and since when it has
 * been above the line. Only an armed item alerts when it runs low; the
 * alert disarms it until stock is above the line again.
 */
export const StockWatch = model
  .define("stock_watch", {
    id: model.id({ prefix: "stw" }).primaryKey(),
    inventory_item_id: model.text(),
    threshold: model.number().nullable(),
    armed_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["inventory_item_id"], unique: true, where: "deleted_at IS NULL" }])
