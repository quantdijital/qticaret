import type { MedusaContainer } from "@medusajs/framework/types"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import type { MediaAssetRecord } from "../../modules/media/service"
import { isReferenced, readMediaReferences } from "./references"
import { mediaUses } from "./usage"

type Container = Pick<MedusaContainer, "resolve">

const KEY_FIELDS = ["id", "url", "file_id", "derivatives", "derivative_file_ids"] as const

/**
 * The library's pictures nothing shows (M1, docs/06 Ortam kütüphanesi),
 * newest first: every file of the library (matching `filters`, the
 * search) checked against every place that may point at it, then one
 * page of them. Each look reads the whole library and every source, so
 * the count is what is unused now.
 */
export async function unusedMediaPage(
  container: Container,
  filters: Record<string, unknown>,
  page: { offset: number; limit: number }
): Promise<{ media: MediaAssetRecord[]; count: number }> {
  const service = container.resolve<MediaModuleService>(MEDIA_MODULE)
  const library = await service.listMediaAssets(filters, {
    select: [...KEY_FIELDS],
    order: { created_at: "DESC", id: "DESC" },
    take: null,
  })
  const references = await readMediaReferences(
    container,
    library.map((asset) => asset.id)
  )
  const unused = library.filter((asset) => !isReferenced(asset, references))
  const ids = unused.slice(page.offset, page.offset + page.limit).map((asset) => asset.id)
  const rows = ids.length > 0 ? await service.listMediaAssets({ id: ids }, { take: null }) : []
  const byId = new Map(rows.map((row) => [row.id, row]))
  return {
    media: ids.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    }),
    count: unused.length,
  }
}

/** The pictures asked to be deleted, sorted: the ones nothing shows, and the rest. */
export interface UnusedSort {
  unused: MediaAssetRecord[]
  /** Shown somewhere (or not certainly unused): kept. */
  inUse: string[]
  /** Not in the library (gone, or never a stored file). */
  missing: string[]
}

/**
 * Sorts pictures for a bulk delete: a picture goes only when the wide
 * check (every source, `references.ts`) and the detail's own uses
 * (`mediaUses`) both find nothing. Reads only.
 */
export async function sortUnused(
  container: Container,
  ids: readonly string[]
): Promise<UnusedSort> {
  const assets = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ id: [...ids], file_id: { $ne: null } }, { take: null })
  const found = new Map(assets.map((asset) => [asset.id, asset]))
  const references = await readMediaReferences(container, [...found.keys()])
  const sort: UnusedSort = { unused: [], inUse: [], missing: [] }
  for (const id of ids) {
    const asset = found.get(id)
    if (!asset) {
      sort.missing.push(id)
    } else if (isReferenced(asset, references) || (await mediaUses(container, asset)).length > 0) {
      sort.inUse.push(id)
    } else {
      sort.unused.push(asset)
    }
  }
  return sort
}
