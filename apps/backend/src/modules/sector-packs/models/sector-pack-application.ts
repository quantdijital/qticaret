import { model } from "@medusajs/framework/utils"

/**
 * A sector pack this shop was set up with (adr/0061 C12): the newest
 * version applied and when. The items it offered are `sector_pack_item`.
 */
export const SectorPackApplication = model.define("sector_pack_application", {
  id: model.id({ prefix: "spapp" }).primaryKey(),
  pack: model.text().unique(),
  version: model.number(),
  applied_at: model.dateTime(),
})
