import { model } from "@medusajs/framework/utils"

/**
 * A file of the old site's media library and the picture it became here
 * (adr/0059): `/wp-content/uploads/2024/05/kapak.jpg` on the old host
 * answers a 301 to the media asset's address while the asset is there.
 * `path` as rules store it (lower case); `stem` without the extension
 * and the platform's size suffixes (`kapak-300x200.jpg`), so every size
 * of one upload finds it. Written by a migration from its moved pictures.
 */
export const MigrationFile = model
  .define("migration_file", {
    id: model.id({ prefix: "mfile" }).primaryKey(),
    source: model.text(),
    path: model.text(),
    stem: model.text(),
    media_id: model.text(),
  })
  .indexes([
    { on: ["path"], unique: true, where: "deleted_at IS NULL" },
    { on: ["stem"], where: "deleted_at IS NULL" },
  ])
