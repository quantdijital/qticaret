import { model } from "@medusajs/framework/utils"

/**
 * When the sitemap last came out and since when a page change waits for
 * the next one (one row). A change marks it; the refresh job regenerates
 * once changes have settled, and once a day in any case. The same row
 * keeps the shop's IndexNow key and when changes were last announced.
 */
export const SitemapState = model.define("sitemap_state", {
  id: model.id({ prefix: "smst" }).primaryKey(),
  key: model.text().unique(),
  dirty_since: model.dateTime().nullable(),
  generated_at: model.dateTime().nullable(),
  indexnow_key: model.text().nullable(),
  indexnow_pinged_at: model.dateTime().nullable(),
})
