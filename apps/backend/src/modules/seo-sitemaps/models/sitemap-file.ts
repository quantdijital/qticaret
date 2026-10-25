import { model } from "@medusajs/framework/utils"

/**
 * One generated sitemap file (docs/13 §6), served as it is by the Store
 * API: the index and a file per kind of page and page of 50,000 URLs.
 * Kept in the database: an instance holds one shop's few files, and a
 * fixed name per file is what the storefront asks for.
 */
export const SitemapFile = model
  .define("sitemap_file", {
    id: model.id({ prefix: "smap" }).primaryKey(),
    name: model.text(),
    content: model.text(),
    url_count: model.number().default(0),
    generated_at: model.dateTime(),
  })
  .indexes([{ on: ["name"], unique: true, where: "deleted_at IS NULL" }])
