import type { MedusaContainer } from "@medusajs/framework/types"
import { oldAddressOf } from "../../lib/migration/addresses"
import { uploadStem } from "../../lib/seo/legacy"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { InventoryUrl, KeptFile, RememberedItem } from "../../modules/migration/service"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"

/**
 * The old WordPress site's addresses a migration knows besides its
 * records' permalinks (adr/0059), written as explicit entries:
 * - a subcategory's short path (`/tavalar/` beside `/mutfak/tavalar/`;
 *   WooCommerce serves both) joins the address inventory tied to its
 *   category, so it is kept for it as the full one is;
 * - each moved picture's file on the old host (`/wp-content/uploads/…`)
 *   is kept with the media asset it became, for its 301.
 * The open-ended kinds (numbered pages, archives, feeds) are rules in
 * resolve (`seo/redirects/legacy.ts`). Safe to run again.
 */

type Container = Pick<MedusaContainer, "resolve">

export interface LegacyCounts {
  /** Subcategories' short paths: found, new to the inventory, in it already. */
  short_paths: { found: number; added: number; known: number }
  /** The moved pictures' files on the old host: found, new, and those served from another host. */
  files: { found: number; added: number; elsewhere: number }
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "")

const parentOf = (path: string) => path.slice(0, path.lastIndexOf("/")) || "/"

/**
 * The short path of each subcategory: its archive base (the root, or
 * `/urun-kategori`) and its own slug, read from the categories' old paths
 * (a parent's path is its child's without the last segment). None for a
 * top-level category or a short path that is another category's.
 */
export function shortCategoryPaths(
  categories: readonly { path: string; target_id: string }[]
): { path: string; target_id: string }[] {
  const paths = new Set(categories.map((category) => category.path))
  const shorts: { path: string; target_id: string }[] = []
  for (const category of categories) {
    let top = category.path
    while (top !== "/" && paths.has(parentOf(top))) {
      top = parentOf(top)
    }
    if (top === category.path) {
      continue
    }
    const base = parentOf(top)
    const slug = category.path.slice(category.path.lastIndexOf("/") + 1)
    const path = base === "/" ? `/${slug}` : `${base}/${slug}`
    if (!paths.has(path)) {
      shorts.push({ path, target_id: category.target_id })
    }
  }
  return shorts
}

/** A picture item's old address (`<product key> <url>`) as a file path, when on the old host. */
export function filePathOf(sourceKey: string, host: string): string | null | undefined {
  const url = sourceKey.slice(sourceKey.indexOf(" ") + 1)
  if (!URL.canParse(url)) {
    return undefined
  }
  const parsed = new URL(url)
  if (bareHost(parsed.hostname) !== bareHost(host)) {
    return null
  }
  return oldAddressOf(parsed.pathname)?.path ?? undefined
}

async function shortPaths(container: Container, source: string, apply: boolean) {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const items = await migration.listMigrationItems(
    { source, kind: "category", status: "done", old_url: { $ne: null }, target_id: { $ne: null } },
    { select: ["old_url", "target_id"], take: null }
  )
  const categories = items.flatMap((item) => {
    const path = item.old_url ? oldAddressOf(item.old_url)?.path : undefined
    return path && item.target_id ? [{ path, target_id: item.target_id }] : []
  })
  const shorts = shortCategoryPaths(categories)
  const held = new Set(
    shorts.length
      ? (
          await migration.listMigrationUrls(
            { address: shorts.map((short) => short.path) },
            { select: ["address"], take: null }
          )
        ).map((row) => row.address)
      : []
  )
  const fresh: InventoryUrl[] = shorts
    .filter((short) => !held.has(short.path))
    .map((short) => ({
      address: short.path,
      path: short.path,
      query: null,
      origin: "source",
      entity_type: CATALOG_ENTITY_TYPES.category,
      entity_id: short.target_id,
    }))
  if (apply && fresh.length > 0) {
    await migration.addUrls(fresh)
  }
  // One the inventory has (a run before, another record's address) is left as it is
  return { found: shorts.length, added: fresh.length, known: shorts.length - fresh.length }
}

async function files(container: Container, source: string, apply: boolean) {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const host = source.split(":").slice(1).join(":")
  const items = await migration.listMigrationItems(
    { source, kind: "image", status: "done", target_id: { $ne: null } },
    { select: ["source_key", "target_id"], take: null }
  )
  const kept: KeptFile[] = []
  let elsewhere = 0
  for (const item of items) {
    const path = filePathOf(item.source_key, host)
    if (path === null) {
      elsewhere += 1
    } else if (path && item.target_id) {
      kept.push({ path, stem: uploadStem(path), media_id: item.target_id })
    }
  }
  const unique = [...new Map(kept.map((file) => [file.path, file])).values()]
  if (apply) {
    return { found: unique.length, added: await migration.keepFiles(source, unique), elsewhere }
  }
  const known = unique.length
    ? await migration.listMigrationFiles(
        { path: unique.map((file) => file.path) },
        { select: ["path"], take: null }
      )
    : []
  return { found: unique.length, added: unique.length - known.length, elsewhere }
}

/** Writes (or with `apply` false, counts) a WordPress source's explicit legacy entries. */
export async function recordLegacyAddresses(
  container: Container,
  source: string,
  apply: boolean
): Promise<LegacyCounts> {
  if (!source.startsWith("wordpress")) {
    return {
      short_paths: { found: 0, added: 0, known: 0 },
      files: { found: 0, added: 0, elsewhere: 0 },
    }
  }
  const counts = {
    short_paths: await shortPaths(container, source, apply),
    files: await files(container, source, apply),
  }
  if (apply) {
    await container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions()
  }
  return counts
}

/**
 * Covers of posts and pages moved before their pictures were remembered
 * (adr/0059): each moved entry's cover, by its old address, as a picture
 * item of the entry's source key, so its file joins the others. How many
 * covers the export names and how many were new.
 */
export async function rememberCovers(
  container: Container,
  source: string,
  covers: readonly { source_key: string; url: string }[],
  apply: boolean
): Promise<{ found: number; added: number }> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const keys = covers.map((cover) => cover.source_key)
  const entries = new Map(
    [
      ...(await migration.targetsOf(source, "post", keys)),
      ...(await migration.targetsOf(source, "page", keys)),
    ].flatMap(([key, item]) =>
      item.status === "done" && item.target_id ? [[key, item.target_id] as const] : []
    )
  )
  const images = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentEntries({ id: [...entries.values()] }, { select: ["id", "image_url"], take: null })
  const urls = images.flatMap((entry) => (entry.image_url ? [entry.image_url] : []))
  const assets = urls.length
    ? await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ url: urls }, { select: ["id", "url"] })
    : []
  const assetOf = new Map(assets.map((asset) => [asset.url, asset.id]))
  const imageOf = new Map(images.map((entry) => [entry.id, entry.image_url]))
  const items: RememberedItem[] = covers.flatMap((cover) => {
    const entry = entries.get(cover.source_key)
    const url = entry ? imageOf.get(entry) : null
    const asset = url ? assetOf.get(url) : undefined
    return asset
      ? [{ source_key: `${cover.source_key} ${cover.url}`, target_id: asset, status: "done" }]
      : []
  })
  const known = await migration.targetsOf(
    source,
    "image",
    items.map((item) => item.source_key)
  )
  if (apply && items.length > 0) {
    await migration.remember(source, "image", items)
  }
  return { found: items.length, added: items.filter((item) => !known.has(item.source_key)).length }
}
