import { model } from "@medusajs/framework/utils"

/**
 * A brand (F3.11, docs/13): its page at `/marka/{handle}` (or `/{handle}`
 * in the flat URL style), a description, a logo from the shop's own
 * uploads (its id, and the URL the page shows), and whether its page is
 * live. Products link to one brand; its SEO fields link like a category's.
 */
export const Brand = model
  .define("brand", {
    id: model.id({ prefix: "brand" }).primaryKey(),
    name: model.text(),
    handle: model.text(),
    description: model.text().nullable(),
    logo_file_id: model.text().nullable(),
    logo_url: model.text().nullable(),
    is_active: model.boolean().default(true),
  })
  .indexes([{ on: ["handle"], unique: true, where: "deleted_at IS NULL" }])
