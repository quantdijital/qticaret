import { model } from "@medusajs/framework/utils"

/**
 * An image the shop uploaded (F3.3, adr/0016) and its place in the media
 * library: the cleaned master in file storage and its public URL (what a
 * product, a page or a logo holds), its size, its alt text, and the
 * versions it is served in: a WebP/AVIF `srcset` and a share crop, named
 * after the product. `derived_for` says which product slug and position
 * they were made for; a rename or a move remakes them. A library picture
 * no product holds gets them at upload, named after itself (`derived_for`
 * null; docs/21 2026-11-06). Linked to its
 * product (one product, many images). An image added by its URL alone (an
 * import, Medusa's own admin) gets a record too, for its alt text; it has
 * no master to make versions of and is not in the library.
 */
export const MediaAsset = model
  .define("media_asset", {
    id: model.id({ prefix: "media" }).primaryKey(),
    // None for an image added by its URL before the pipeline (no master to read)
    file_id: model.text().nullable(),
    url: model.text(),
    // The name the library shows and searches; renaming it leaves the address as it is
    filename: model.text().nullable(),
    mime_type: model.text().nullable(),
    // Bytes of the stored (cleaned) master
    size: model.number().nullable(),
    width: model.number().nullable(),
    height: model.number().nullable(),
    alt: model.text().nullable(),
    // The staff member who uploaded or imported it (a user id); null for older uploads
    uploaded_by: model.text().nullable(),
    // Put in the library on purpose (its page, an image picker): kept until
    // deleted there, never taken by the nightly sweep of abandoned uploads
    in_library: model.boolean().default(false),
    derived_for: model.text().nullable(),
    // { srcset: { webp: [{ width, url }], avif: [...] }, og: { url, width, height } }
    derivatives: model.json().nullable(),
    // The versions' files, removed when they are remade or the image goes
    derivative_file_ids: model.array().nullable(),
    derived_at: model.dateTime().nullable(),
    // First put on a product: from then on orders and emails may show it, so
    // its master is kept even if the product drops it. Never attached, an
    // upload left behind is removed after a day.
    attached_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["url"], unique: true, where: "deleted_at IS NULL" },
    { on: ["file_id"], where: "deleted_at IS NULL AND file_id IS NOT NULL" },
    // The library's pages: stored files, newest first
    { on: ["created_at"], where: "deleted_at IS NULL AND file_id IS NOT NULL" },
  ])
