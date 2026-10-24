import { model } from "@medusajs/framework/utils"
import { TrDistrict } from "./district"

/**
 * Province (il). `code` is the two-digit plate code, which is also the
 * postal code prefix. `match_key` and `sort_key` come from lib/tr/text.
 */
export const TrProvince = model
  .define("tr_province", {
    id: model.id({ prefix: "trprv" }).primaryKey(),
    code: model.text(),
    name: model.text().searchable(),
    match_key: model.text(),
    sort_key: model.text(),
    is_active: model.boolean().default(true),
    districts: model.hasMany(() => TrDistrict, { mappedBy: "province" }),
  })
  .indexes([
    { on: ["code"], unique: true, where: "deleted_at IS NULL" },
    { on: ["match_key"], where: "deleted_at IS NULL" },
  ])
