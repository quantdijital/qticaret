import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CATEGORY_URL_STYLES, categoryPath, isValidSlug } from "../../lib/seo"
import type { CategoryUrlStyle } from "../../lib/seo"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SeoSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Which category URL style keeps the old site's category addresses as
 * they were (adr/0017 Ek 2026-11-23): a WooCommerce site with its base
 * taken off served `/ust/alt`, the nested style's own form. Said, never
 * set: the owner moves the style in SEO settings, and every 301 follows.
 */
export interface CategoryStyleHint {
  current: CategoryUrlStyle
  /** The old category addresses tied to a category here. */
  total: number
  /** How many of them each style would serve unchanged. */
  kept: Record<CategoryUrlStyle, number>
  /** A style that keeps more of them than the current one; null when the current keeps the most. */
  suggested: CategoryUrlStyle | null
}

const PAGE = 1000

interface CategoryRow {
  id: string
  handle: string
  mpath: string | null
}

/** Each style's path for every category whose chain makes one. */
export function stylePaths(
  categories: readonly CategoryRow[]
): Map<string, Record<CategoryUrlStyle, string>> {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const paths = new Map<string, Record<CategoryUrlStyle, string>>()
  for (const category of categories) {
    const handles = (category.mpath ?? category.id).split(".").map((id) => byId.get(id)?.handle)
    if (handles.every((handle): handle is string => handle !== undefined && isValidSlug(handle))) {
      paths.set(category.id, {
        prefixed: categoryPath(handles, "prefixed"),
        nested: categoryPath(handles, "nested"),
        flat: categoryPath(handles, "flat"),
      })
    }
  }
  return paths
}

/** The counts and the suggestion, from the old addresses and each style's paths. */
export function hintOf(
  current: CategoryUrlStyle,
  old: readonly { path: string; entity_id: string }[],
  paths: Map<string, Record<CategoryUrlStyle, string>>
): CategoryStyleHint | null {
  const kept: Record<CategoryUrlStyle, number> = { prefixed: 0, nested: 0, flat: 0 }
  let total = 0
  for (const row of old) {
    const own = paths.get(row.entity_id)
    if (!own) {
      continue
    }
    total += 1
    for (const style of CATEGORY_URL_STYLES) {
      kept[style] += own[style] === row.path ? 1 : 0
    }
  }
  if (total === 0) {
    return null
  }
  // The current style wins a tie: a move is worth it only for more kept addresses
  const best = CATEGORY_URL_STYLES.reduce(
    (top, style) => (kept[style] > kept[top] ? style : top),
    current
  )
  return { current, total, kept, suggested: best === current ? null : best }
}

/** The hint for the shop's inventory now; null when no old category address is tied to a category. */
export async function categoryStyleHint(container: Container): Promise<CategoryStyleHint | null> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const old: { path: string; entity_id: string }[] = []
  for (let skip = 0; ; skip += PAGE) {
    const rows = await migration.listMigrationUrls(
      { entity_type: CATALOG_ENTITY_TYPES.category, entity_id: { $ne: null }, query: null },
      { select: ["path", "entity_id"], skip, take: PAGE, order: { id: "ASC" } }
    )
    old.push(
      ...rows.flatMap((row) =>
        row.entity_id ? [{ path: row.path, entity_id: row.entity_id }] : []
      )
    )
    if (rows.length < PAGE) {
      break
    }
  }
  if (old.length === 0) {
    return null
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data }, seo] = await Promise.all([
    // Shops keep hundreds of categories at most
    query.graph({ entity: "product_category", fields: ["id", "handle", "mpath"] }),
    container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE).getSection("seo"),
  ])
  const current = (seo as unknown as SeoSettings).url_style.category
  return hintOf(current, old, stylePaths(data as CategoryRow[]))
}
