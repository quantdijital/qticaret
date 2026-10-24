import { model } from "@medusajs/framework/utils"
import { TrDistrict } from "./district"

/** Neighborhood (mahalle) with its postal code, unique by name within its district. */
export const TrNeighborhood = model
  .define("tr_neighborhood", {
    id: model.id({ prefix: "trnbh" }).primaryKey(),
    name: model.text().searchable(),
    postal_code: model.text(),
    match_key: model.text(),
    sort_key: model.text(),
    is_active: model.boolean().default(true),
    district: model.belongsTo(() => TrDistrict, { mappedBy: "neighborhoods" }),
  })
  .indexes([{ on: ["district_id", "match_key"], unique: true, where: "deleted_at IS NULL" }])
