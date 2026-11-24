import { model } from "@medusajs/framework/utils"

/**
 * A pop-up's counts on one day (UTC, `YYYY-MM-DD`; adr/0080 §7): shown,
 * clicked, closed, signed up from. Numbers only: no visitor, no address.
 */
export const PopupMetric = model
  .define("popup_metric", {
    id: model.id({ prefix: "popmet" }).primaryKey(),
    popup_id: model.text(),
    day: model.text(),
    impressions: model.number().default(0),
    clicks: model.number().default(0),
    closes: model.number().default(0),
    signups: model.number().default(0),
  })
  .indexes([{ on: ["popup_id", "day"], unique: true, where: "deleted_at IS NULL" }])
