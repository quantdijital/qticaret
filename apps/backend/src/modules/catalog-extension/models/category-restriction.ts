import { model } from "@medusajs/framework/utils"
import { RESTRICTIONS } from "../../../lib/catalog/restrictions"

/**
 * A category sold to adults only, and why (F13.4, adr/0041 §4): its
 * children and every product in them are too. A category without a mark
 * has no row.
 */
export const CategoryRestriction = model
  .define("category_restriction", {
    id: model.id({ prefix: "crest" }).primaryKey(),
    category_id: model.text(),
    restriction: model.enum([...RESTRICTIONS]),
  })
  .indexes([
    {
      name: "IDX_category_restriction_category",
      on: ["category_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
