import { model } from "@medusajs/framework/utils"

/** The last run of each part of the nightly insights job, and what stopped it (F10.11). */
export const InsightRun = model
  .define("insight_run", {
    id: model.id({ prefix: "insrun" }).primaryKey(),
    /** sitemap, search, inspection, crux. */
    kind: model.text(),
    ran_at: model.dateTime(),
    /** Google's word when it failed; null when it went well. */
    error: model.text().nullable(),
  })
  .indexes([{ on: ["kind"], unique: true, where: "deleted_at IS NULL" }])
