import { model } from "@medusajs/framework/utils"

/**
 * One storefront path and the record it belongs to (docs/13 §2.1). A path
 * is unique per locale across every entity type; an old path stays
 * `reserved` for its record after a slug change, so no other record can take
 * it while its redirect lives.
 */
export const UrlEntry = model
  .define("url_entry", {
    id: model.id({ prefix: "url" }).primaryKey(),
    locale: model.text(),
    path: model.text(),
    status: model.enum(["active", "reserved"]).default("active"),
    entity_type: model.text(),
    entity_id: model.text(),
  })
  .indexes([
    { on: ["locale", "path"], unique: true, where: "deleted_at IS NULL" },
    { on: ["entity_type", "entity_id"], where: "deleted_at IS NULL" },
  ])
