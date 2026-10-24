import { model } from "@medusajs/framework/utils"
import { TrNeighborhood } from "./neighborhood"
import { TrProvince } from "./province"

/** District (ilçe), unique by name within its province. */
export const TrDistrict = model
  .define("tr_district", {
    id: model.id({ prefix: "trdst" }).primaryKey(),
    name: model.text().searchable(),
    match_key: model.text(),
    sort_key: model.text(),
    is_active: model.boolean().default(true),
    province: model.belongsTo(() => TrProvince, { mappedBy: "districts" }),
    neighborhoods: model.hasMany(() => TrNeighborhood, { mappedBy: "district" }),
  })
  .indexes([{ on: ["province_id", "match_key"], unique: true, where: "deleted_at IS NULL" }])
