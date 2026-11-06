import type { MedusaContainer } from "@medusajs/framework/types"
import { ALT_MAX } from "../../lib/media"
import { uploadStem } from "../../lib/seo/legacy"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { filePathOf } from "./legacy-addresses"

/**
 * The files of the categories' pictures (adr/0042 Ek 2026-11-06): the
 * address one is fetched from, its alt text as a category image takes it,
 * and the media library's pictures a migration stored for the same file
 * already (`category-covers.ts`).
 */

type Container = Pick<MedusaContainer, "resolve">

export interface StoredAsset {
  id: string
  url: string
}

/** The old site's host a source names (`wordpress:eski.example.com`). */
export const hostOf = (source: string): string => source.split(":").slice(1).join(":")

/** A picture item's address (`<record key> <url>`). */
const urlOfKey = (key: string) => key.slice(key.indexOf(" ") + 1)

/** The address fetched: HTTPS, the same file; a fake old site's own origin as it is. */
export function httpsAddress(url: string, fake: string | undefined): string {
  if (!URL.canParse(url)) {
    return url
  }
  const parsed = new URL(url)
  if (fake && URL.canParse(fake) && new URL(fake).origin === parsed.origin) {
    return url
  }
  if (parsed.protocol === "http:") {
    parsed.protocol = "https:"
  }
  return parsed.toString()
}

/** A cover's alt text as the category image takes it: one line, within the cap; none for none. */
export const coverAltText = (alt: string): string | null =>
  alt.replace(/\s+/g, " ").trim().slice(0, ALT_MAX).trim() || null

/**
 * The media library's pictures the migration stored for these addresses
 * already: a picture item of this source with the same address, else the
 * old file with the same path (adr/0059), else one with its stem (another
 * size of the same upload). Only uploads still in the library count.
 */
export async function storedAssets(
  container: Container,
  source: string,
  urls: readonly string[]
): Promise<Map<string, StoredAsset>> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const candidates = new Map<string, string[]>(urls.map((url) => [url, []]))
  const items = await migration.listMigrationItems(
    { source, kind: "image", status: "done", target_id: { $ne: null } },
    { select: ["source_key", "target_id"], take: null }
  )
  for (const item of items) {
    if (item.target_id) {
      candidates.get(urlOfKey(item.source_key))?.push(item.target_id)
    }
  }
  // Files on the old host only: one served elsewhere (a CDN) was never kept by path
  const paths = new Map(
    urls.flatMap((url) => {
      const path = filePathOf(`- ${url}`, hostOf(source))
      return path ? [[url, path] as const] : []
    })
  )
  const filesWith = (filter: { path: string[] } | { stem: string[] }) =>
    migration.listMigrationFiles(filter, { select: ["path", "stem", "media_id"], take: null })
  const files = paths.size
    ? [
        ...(await filesWith({ path: [...paths.values()] })),
        ...(await filesWith({ stem: [...new Set([...paths.values()].map(uploadStem))] })),
      ]
    : []
  for (const [url, path] of paths) {
    const own = candidates.get(url) ?? []
    own.push(...files.filter((file) => file.path === path).map((file) => file.media_id))
    own.push(...files.filter((file) => file.stem === uploadStem(path)).map((file) => file.media_id))
  }
  const ids = [...new Set([...candidates.values()].flat())]
  const assets = ids.length
    ? await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ id: ids, file_id: { $ne: null } }, { select: ["id", "url"], take: null })
    : []
  const byId = new Map(assets.map((asset) => [asset.id, { id: asset.id, url: asset.url }]))
  const found = new Map<string, StoredAsset>()
  for (const [url, own] of candidates) {
    const asset = own.map((id) => byId.get(id)).find((each) => each !== undefined)
    if (asset) {
      found.set(url, asset)
    }
  }
  return found
}
