import { model } from "@medusajs/framework/utils"

/**
 * What Medusa's product category has no column for beyond its picture and
 * mark, by the category's id as `category_image` is (adr/0075):
 * - `description_doc`: the category page's text as a content document
 *   (`lib/catalog/listing-description`); Medusa's `description` keeps its
 *   plain text, the meta description's fallback, search's and the
 *   advisor's. Null: plain text only.
 * A category without a row has plain text only.
 */
export const CategoryExtension = model
  .define("category_extension", {
    id: model.id({ prefix: "cext" }).primaryKey(),
    category_id: model.text(),
    description_doc: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_category_extension_category",
      on: ["category_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
