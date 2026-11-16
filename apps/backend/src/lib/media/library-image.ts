import type { MedusaContainer } from "@medusajs/framework/types"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import type { MediaAssetRecord } from "../../modules/media/service"

/** How a page names the picture it holds: by its public address or by its storage key. */
export type LibraryImageRef = { url: string } | { file_id: string }

/** Whether a record's type says it is an image; one with no type (an older upload) passed the upload's own check. */
export const isImageType = (mimeType: string | null | undefined): boolean =>
  mimeType === null || mimeType === undefined || mimeType.startsWith("image/")

/**
 * The media library's record of one of the shop's own uploads (an image
 * stored through the checked upload route and registered, F3.3), or null.
 * What a logo, a category's or a collection's picture, a page's cover may
 * hold (docs/06 Ortam kütüphanesi): never an outside address (a record
 * made of an address alone has no stored file), never a file put in
 * storage some other way (an invoice, a label, a feed, a job's result:
 * no record), never a record whose type is no image. `select` names the
 * fields the caller reads besides `id`, `file_id`, `url` and `mime_type`.
 */
export async function libraryImage(
  container: Pick<MedusaContainer, "resolve">,
  ref: LibraryImageRef,
  select: readonly (keyof MediaAssetRecord)[] = []
): Promise<MediaAssetRecord | null> {
  const filters = "url" in ref ? { url: ref.url, file_id: { $ne: null } } : { file_id: ref.file_id }
  const fields = [...new Set(["id", "file_id", "url", "mime_type", ...select])]
  const [asset] = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets(filters, { select: fields, take: 1 })
  return asset?.file_id && isImageType(asset.mime_type) ? asset : null
}
