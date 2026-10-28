import { model } from "@medusajs/framework/utils"

/**
 * A segment the shop defines by rules (F10.3, adr/0037 §6). Its members
 * are written into a Medusa customer group of its own, refreshed daily,
 * which promotions and price lists target like any group.
 */
export const CustomerSegment = model
  .define("customer_segment", {
    id: model.id({ prefix: "cseg" }).primaryKey(),
    name: model.text(),
    /** `SegmentRules` (lib/customers/segments.ts). */
    rules: model.json(),
    /** The Medusa customer group the segment fills. */
    customer_group_id: model.text(),
    member_count: model.number().default(0),
    refreshed_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["name"], unique: true, where: "deleted_at IS NULL" },
    { on: ["customer_group_id"], unique: true, where: "deleted_at IS NULL" },
  ])
