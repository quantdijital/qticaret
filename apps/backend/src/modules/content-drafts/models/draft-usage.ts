import { model } from "@medusajs/framework/utils"

/** Drafts asked for in a month, against the shop's monthly quota (adr/0005). */
export const DraftUsage = model
  .define("draft_usage", {
    id: model.id({ prefix: "dusage" }).primaryKey(),
    /** `YYYY-MM`. */
    month: model.text(),
    count: model.number().default(0),
  })
  .indexes([{ on: ["month"], unique: true, where: "deleted_at IS NULL" }])
