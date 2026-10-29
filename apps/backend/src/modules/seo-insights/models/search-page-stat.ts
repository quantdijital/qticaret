import { model } from "@medusajs/framework/utils"

/**
 * A page's last 28 days in Google Search, beside the 28 before (F10.11):
 * replaced whole every night. CTR is kept in basis points and position in
 * hundredths, as whole numbers.
 */
export const SearchPageStat = model
  .define("search_page_stat", {
    id: model.id({ prefix: "gscpage" }).primaryKey(),
    path: model.text(),
    clicks: model.number(),
    impressions: model.number(),
    ctr_bp: model.number(),
    position_x100: model.number(),
    prev_clicks: model.number(),
    prev_impressions: model.number(),
    /** The last day counted (`YYYY-MM-DD`, Search Console's time). */
    period_end: model.text(),
  })
  .indexes([{ on: ["path"], unique: true, where: "deleted_at IS NULL" }])
