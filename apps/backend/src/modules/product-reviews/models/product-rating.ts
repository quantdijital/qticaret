import { model } from "@medusajs/framework/utils"

/** A product's approved reviews summed (F10.6): the storefront's stars and JSON-LD's aggregateRating. */
export const ProductRating = model
  .define("product_rating", {
    id: model.id({ prefix: "prat" }).primaryKey(),
    product_id: model.text(),
    review_count: model.number().default(0),
    /** The ratings added up; the average is this over the count. */
    rating_total: model.number().default(0),
  })
  .indexes([{ on: ["product_id"], unique: true, where: "deleted_at IS NULL" }])
