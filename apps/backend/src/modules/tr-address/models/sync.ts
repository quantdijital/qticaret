import { model } from "@medusajs/framework/utils"

/**
 * One import of the reference data that went through (adr/0008 Ek
 * 2026-11-04), written in the import's own transaction, so the version
 * recorded is always the data's. The newest says where the data came from
 * and which TürkiyeAPI dataset it is (`dataset_version` "2025",
 * `dataset_last_updated` "2026-05-21"; null for a file); the weekly check
 * compares it with `/meta`. `report` holds counts only.
 */
export const TrAddressSync = model.define("tr_address_sync", {
  id: model.id({ prefix: "trsync" }).primaryKey(),
  source: model.enum(["turkiyeapi", "file"]),
  dataset_version: model.text().nullable(),
  dataset_last_updated: model.text().nullable(),
  report: model.json().nullable(),
})
