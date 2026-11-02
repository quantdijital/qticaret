import { model } from "@medusajs/framework/utils"

/**
 * A publication of the storefront's design (adr/0049): the document as it
 * went live, kept so staff can bring it back into the draft. The latest
 * twenty are kept.
 */
export const StorefrontLayoutRevision = model
  .define("storefront_layout_revision", {
    id: model.id({ prefix: "sflrev" }).primaryKey(),
    revision: model.number(),
    document: model.json(),
    published_at: model.dateTime(),
    published_by: model.text().nullable(),
  })
  .indexes([{ on: ["revision"], unique: true, where: "deleted_at IS NULL" }])
