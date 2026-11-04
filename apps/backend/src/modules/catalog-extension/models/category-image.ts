import { model } from "@medusajs/framework/utils"

/**
 * A category's picture (adr/0046 Ek 2026-11-04): one image of the shop's
 * media library, by its address, with its alt text. The storefront's
 * category cards and mega menu show it. A category without a picture has
 * no row.
 */
export const CategoryImage = model
  .define("category_image", {
    id: model.id({ prefix: "cimg" }).primaryKey(),
    category_id: model.text(),
    url: model.text(),
    alt: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_category_image_category",
      on: ["category_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    // The media library's "in use" check finds it by its address
    { name: "IDX_category_image_url", on: ["url"], where: "deleted_at IS NULL" },
  ])
