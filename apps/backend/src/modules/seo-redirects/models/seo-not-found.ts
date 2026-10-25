import { model } from "@medusajs/framework/utils"

/**
 * A storefront path that answered 404 (docs/13 §4): how often, since when,
 * and the host of the last page that linked to it. No visitor data: the
 * referer is cut to its host. Counted in batches; rows nobody asked for in
 * a while are pruned.
 */
export const SeoNotFound = model
  .define("seo_not_found", {
    id: model.id({ prefix: "nf" }).primaryKey(),
    path: model.text(),
    hits: model.number().default(0),
    first_seen_at: model.dateTime(),
    last_seen_at: model.dateTime(),
    last_referer_host: model.text().nullable(),
  })
  .indexes([
    { on: ["path"], unique: true, where: "deleted_at IS NULL" },
    { on: ["last_seen_at"], where: "deleted_at IS NULL" },
  ])
