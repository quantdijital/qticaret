import { model } from "@medusajs/framework/utils"

/**
 * When the shop's address moved here from its old platform (F14.7,
 * adr/0042 §8): for thirty days after, the storefront's 404s are watched
 * and told to the owner. `watched_at`: how far the watch has looked.
 */
export const MigrationCutover = model.define("migration_cutover", {
  id: model.id({ prefix: "mcut" }).primaryKey(),
  cutover_at: model.dateTime(),
  by: model.text().nullable(),
  watched_at: model.dateTime().nullable(),
})
