import { model } from "@medusajs/framework/utils"
import { TrDistrict } from "./district"

/**
 * A settlement of a district with its postal code: a neighbourhood
 * (mahalle) or a village (köy, `kind: village`), unique by name among the
 * district's active ones. `postal_code_status` is the source's certainty
 * (TürkiyeAPI: official PTT, derived, estimated); null for a file, which
 * counts as official. `external_id` is the source's own id.
 */
export const TrNeighborhood = model
  .define("tr_neighborhood", {
    id: model.id({ prefix: "trnbh" }).primaryKey(),
    name: model.text().searchable(),
    postal_code: model.text(),
    match_key: model.text(),
    sort_key: model.text(),
    is_active: model.boolean().default(true),
    kind: model.enum(["neighborhood", "village"]).default("neighborhood"),
    postal_code_status: model.enum(["official", "derived", "estimated"]).nullable(),
    external_id: model.text().nullable(),
    district: model.belongsTo(() => TrDistrict, { mappedBy: "neighborhoods" }),
  })
  .indexes([
    {
      on: ["district_id", "match_key"],
      unique: true,
      where: "deleted_at IS NULL AND is_active = true",
    },
    {
      on: ["external_id"],
      unique: true,
      where: "deleted_at IS NULL AND external_id IS NOT NULL",
    },
  ])
