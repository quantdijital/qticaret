import { model } from "@medusajs/framework/utils"

export const ITEM_STATUSES = ["done", "skipped", "failed"] as const

/**
 * A source's record and what it became here (adr/0042 §3): one per
 * (source, kind, key), so a migration run again finds what it made before
 * and makes nothing twice (KK2). The old address it was served at, for its
 * 301. A code only for a failure: never a message that may quote data.
 */
export const MigrationItem = model
  .define("migration_item", {
    id: model.id({ prefix: "mitem" }).primaryKey(),
    source: model.text(),
    kind: model.text(),
    source_key: model.text(),
    target_id: model.text().nullable(),
    status: model.enum([...ITEM_STATUSES]),
    error_code: model.text().nullable(),
    old_url: model.text().nullable(),
  })
  .indexes([
    { on: ["source", "kind", "source_key"], unique: true, where: "deleted_at IS NULL" },
    { on: ["source", "kind", "status"] },
  ])
