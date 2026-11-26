import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { displayName } from "../../../lib/media"
import { containsPattern } from "../../../lib/security"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { MediaAssetRecord } from "../../../modules/media/service"
import { unusedMediaPage } from "../../../workflows/media/unused"
import { mediaUses } from "../../../workflows/media/usage"
import type { AdminGetMediaType } from "./validators"

/**
 * An image as the panel sees it: its address and storage key (a brand's
 * logo and a page's own share image hold the key), the name and size the
 * library shows, its alt text. Versions and bookkeeping stay inside.
 */
export const presentMedia = (asset: MediaAssetRecord) => ({
  id: asset.id,
  url: asset.url,
  file_id: asset.file_id,
  filename: asset.filename ?? displayName(asset.file_id ?? asset.url),
  mime_type: asset.mime_type,
  size: asset.size,
  width: asset.width,
  height: asset.height,
  alt: asset.alt,
  // Made by an AI service (adr/0071 §5): `edited` and the picture it came from, which may be gone
  ai_source: asset.ai_source ?? null,
  derived_from_id: asset.derived_from_id ?? null,
  created_at: asset.created_at,
})

/**
 * The library: files in the shop's own storage, newest first, by name, alt
 * text or storage key. An image a product holds by an outside address alone
 * has no file here and is not listed. `missing_alt` keeps those without an
 * alt text; `unused` those nothing shows (M1, checked against every source).
 */
export async function readMediaList(container: MedusaContainer, query: AdminGetMediaType) {
  const pattern = query.q ? containsPattern(query.q) : null
  const search = pattern
    ? {
        $or: [
          { filename: { $ilike: pattern } },
          { alt: { $ilike: pattern } },
          { file_id: { $ilike: pattern } },
        ],
      }
    : {}
  const page = { offset: query.offset, limit: query.limit }
  if (query.view === "unused") {
    const { media, count } = await unusedMediaPage(
      container,
      { file_id: { $ne: null }, ...search },
      page
    )
    return { media: media.map(presentMedia), count, ...page }
  }
  const filters =
    query.view === "missing_alt"
      ? { $and: [{ file_id: { $ne: null } }, { $or: [{ alt: null }, { alt: "" }] }, search] }
      : { file_id: { $ne: null }, ...search }
  const [assets, count] = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listAndCountMediaAssets(filters, {
      skip: query.offset,
      take: query.limit,
      order: { created_at: "DESC", id: "DESC" },
    })
  return { media: assets.map(presentMedia), count, ...page }
}

/** Who uploaded it: a team member's name, else their e-mail; null for older uploads. */
async function uploader(container: MedusaContainer, userId: string | null) {
  if (!userId) {
    return null
  }
  const [user] = await container
    .resolve(Modules.USER)
    .listUsers({ id: userId }, { select: ["id", "first_name", "last_name", "email"], take: 1 })
  if (!user) {
    return null
  }
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
  return { id: user.id, name: name || user.email }
}

/**
 * The picture an AI version was made from, by its name; null when it has
 * been deleted since (`derived_from_id` has no foreign key: the version
 * keeps the id, the panel says the original is gone).
 */
async function original(media: MediaModuleService, id: string | null) {
  if (!id) {
    return null
  }
  const [asset] = await media.listMediaAssets(
    { id },
    { select: ["id", "url", "file_id", "filename"], take: 1 }
  )
  return asset
    ? {
        id: asset.id,
        url: asset.url,
        filename: asset.filename ?? displayName(asset.file_id ?? asset.url),
      }
    : null
}

/** One image with who uploaded it, everywhere the shop shows it and what it was made from. */
export async function readMediaDetail(container: MedusaContainer, id: string) {
  const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
  const [asset] = await media.listMediaAssets({ id }, { take: 1 })
  if (!asset) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "media.unknown")
  }
  const [usage, uploadedBy, derivedFrom] = await Promise.all([
    mediaUses(container, asset),
    uploader(container, asset.uploaded_by),
    original(media, asset.derived_from_id ?? null),
  ])
  return { ...presentMedia(asset), uploaded_by: uploadedBy, usage, derived_from: derivedFrom }
}
