import { model } from "@medusajs/framework/utils"
import { TrNeighborhood } from "./neighborhood"
import { TrProvince } from "./province"

/**
 * District (ilçe), unique by name among its province's active districts:
 * a removed district stays (inactive) beside a new one of its name.
 * `external_id` is the source's own id (`turkiyeapi:district:1103`).
 */
export const TrDistrict = model
  .define("tr_district", {
    id: model.id({ prefix: "trdst" }).primaryKey(),
    name: model.text().searchable(),
    match_key: model.text(),
    sort_key: model.text(),
    is_active: model.boolean().default(true),
    external_id: model.text().nullable(),
    province: model.belongsTo(() => TrProvince, { mappedBy: "districts" }),
    neighborhoods: model.hasMany(() => TrNeighborhood, { mappedBy: "district" }),
  })
  .indexes([
    {
      on: ["province_id", "match_key"],
      unique: true,
      where: "deleted_at IS NULL AND is_active = true",
    },
    {
      on: ["external_id"],
      unique: true,
      where: "deleted_at IS NULL AND external_id IS NOT NULL",
    },
  ])
