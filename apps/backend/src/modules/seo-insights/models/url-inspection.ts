import { model } from "@medusajs/framework/utils"

/** Whether Google has a sitemap page in its index, as URL Inspection last said (F10.11). */
export const UrlInspection = model
  .define("url_inspection", {
    id: model.id({ prefix: "urlinsp" }).primaryKey(),
    path: model.text(),
    /** PASS, PARTIAL, FAIL, NEUTRAL. */
    verdict: model.text(),
    coverage_state: model.text().nullable(),
    last_crawl_at: model.dateTime().nullable(),
    inspected_at: model.dateTime(),
  })
  .indexes([
    { on: ["path"], unique: true, where: "deleted_at IS NULL" },
    { on: ["inspected_at"], where: "deleted_at IS NULL" },
  ])
