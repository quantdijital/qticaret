import { model } from "@medusajs/framework/utils"

/**
 * What Medusa's product collection has no column for (Ürünler >
 * Koleksiyonlar), linked one to one to the collection
 * (`links/collection-catalog-extension.ts`):
 * - `description`: the collection page's intro, plain paragraphs as a
 *   category's and a brand's; the meta description's fallback;
 * - `is_active`: whether its page is public. A hidden collection is as an
 *   inactive category (docs/13 §2.4): its page answers 404 with its path
 *   kept, it leaves the sitemap, menu links and storefront sections that
 *   name it; its products and the promotions that name it are untouched;
 * - `image_url`, `image_alt`: its picture, one image of the shop's media
 *   library by its address, shown at the top of its page.
 * A collection without a row is public, with no text or picture.
 */
export const CollectionExtension = model
  .define("collection_extension", {
    id: model.id({ prefix: "colx" }).primaryKey(),
    description: model.text().nullable(),
    is_active: model.boolean().default(true),
    image_url: model.text().nullable(),
    image_alt: model.text().nullable(),
  })
  .indexes([
    // The media library's "in use" check finds it by its address
    { name: "IDX_collection_extension_image_url", on: ["image_url"], where: "deleted_at IS NULL" },
  ])
