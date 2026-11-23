import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  brandPath,
  categoryPath,
  isReservedPath,
  isValidSlug,
  productPath,
  startsInReservedRoot,
} from "../../lib/seo"
import type { CategoryUrlStyle, UrlStyle } from "../../lib/seo"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import type { ClaimInput } from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"

/**
 * Moving every product, category and brand to another URL style (docs/13 §2.2;
 * the categories' nested style, adr/0017 Ek 2026-11-23):
 * the new paths are claimed record by record, the old ones stay reserved
 * and resolution sends them on with a 301 (adr/0017). A plan comes first:
 * a path two records would share, a page the storefront keeps, or another
 * record's path refuses the change before anything moves.
 */

export interface UrlStyles {
  product: UrlStyle
  category: CategoryUrlStyle
  brand: UrlStyle
}

export interface StyleRecord {
  entity_type: string
  entity_id: string
  name: string
}

export type ConflictReason = "shared" | "reserved_root" | "taken"

export interface StyleConflict {
  path: string
  reason: ConflictReason
  records: StyleRecord[]
  /** Who holds the path now (`taken`); an old path can be released to make room. */
  holder?: { entity_type: string; entity_id: string; status: "active" | "reserved" }
}

export interface StyleMove extends StyleRecord {
  path: string
  replaced: NonNullable<ClaimInput["replaced"]>
}

export interface UrlStylePlan {
  moves: StyleMove[]
  conflicts: StyleConflict[]
  /** Records whose handle makes no slug (from before F3.1): they have no path in any style. */
  skipped: StyleRecord[]
}

const PAGE = 1_000
// Conflicts listed in full up to here; a style that collides more is not one to move to
export const MAX_REPORTED_CONFLICTS = 200

async function allRows<T>(
  container: MedusaContainer,
  entity: string,
  fields: string[]
): Promise<T[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const rows: T[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({ entity, fields, pagination: { skip, take: PAGE } })
    rows.push(...(data as T[]))
    if (data.length < PAGE) {
      return rows
    }
  }
}

interface Wanted extends StyleMove {
  /** Handles that made no valid slug (pre-F3.1 records): no path can be made. */
  invalid?: boolean
  /** A nested category path under a root the storefront keeps (`/sepet/x`). */
  underReservedRoot?: boolean
}

async function wantedPaths(container: MedusaContainer, styles: UrlStyles): Promise<Wanted[]> {
  const [products, categories, brands] = await Promise.all([
    allRows<{ id: string; title: string; handle: string; status: string }>(container, "product", [
      "id",
      "title",
      "handle",
      "status",
    ]),
    allRows<{ id: string; name: string; handle: string; mpath: string | null }>(
      container,
      "product_category",
      ["id", "name", "handle", "mpath"]
    ),
    allRows<{ id: string; name: string; handle: string; is_active: boolean }>(container, "brand", [
      "id",
      "name",
      "handle",
      "is_active",
    ]),
  ])
  const byId = new Map(categories.map((category) => [category.id, category]))
  const wanted: Wanted[] = products.map((product) => ({
    entity_type: CATALOG_ENTITY_TYPES.product,
    entity_id: product.id,
    name: product.title,
    path: isValidSlug(product.handle) ? productPath(product.handle, styles.product) : "",
    invalid: !isValidSlug(product.handle),
    // An unpublished product's old URL was never public: its slug goes back to the pool
    replaced: product.status === "published" ? "reserve" : "free",
  }))
  for (const category of categories) {
    const handles = (category.mpath ?? category.id).split(".").map((id) => byId.get(id)?.handle)
    const valid = handles.every(
      (handle): handle is string => handle !== undefined && isValidSlug(handle)
    )
    const path = valid ? categoryPath(handles, styles.category) : ""
    wanted.push({
      entity_type: CATALOG_ENTITY_TYPES.category,
      entity_id: category.id,
      name: category.name,
      path,
      invalid: !valid,
      underReservedRoot: styles.category === "nested" && valid && startsInReservedRoot(path),
      replaced: "reserve",
    })
  }
  for (const brand of brands) {
    wanted.push({
      entity_type: CATALOG_ENTITY_TYPES.brand,
      entity_id: brand.id,
      name: brand.name,
      path: isValidSlug(brand.handle) ? brandPath(brand.handle, styles.brand) : "",
      invalid: !isValidSlug(brand.handle),
      // An inactive brand's page was not public: its slug goes back to the pool
      replaced: brand.is_active ? "reserve" : "free",
    })
  }
  return wanted
}

const key = (record: { entity_type: string; entity_id: string }) =>
  `${record.entity_type}:${record.entity_id}`
const recordOf = ({ entity_type, entity_id, name }: StyleRecord): StyleRecord => ({
  entity_type,
  entity_id,
  name,
})

/** What moving to `styles` would do: the paths that change and what stands in the way. */
export async function planUrlStyle(
  container: MedusaContainer,
  styles: UrlStyles
): Promise<UrlStylePlan> {
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const wanted = await wantedPaths(container, styles)
  const conflicts: StyleConflict[] = []
  const skipped = wanted.filter((each) => each.invalid).map(recordOf)
  const valid = wanted.filter((each) => !each.invalid)
  const byPath = new Map<string, Wanted[]>()
  for (const each of valid) {
    byPath.set(each.path, [...(byPath.get(each.path) ?? []), each])
  }
  const held = new Map<
    string,
    { entity_type: string; entity_id: string; status: "active" | "reserved" }
  >()
  const paths = [...byPath.keys()]
  for (let start = 0; start < paths.length; start += PAGE) {
    const entries = await registry.listUrlEntries(
      { locale: CATALOG_LOCALE, path: paths.slice(start, start + PAGE) },
      { select: ["path", "entity_type", "entity_id", "status"] }
    )
    for (const entry of entries) {
      held.set(entry.path, entry)
    }
  }
  const moves: StyleMove[] = []
  for (const [path, records] of byPath) {
    const holder = held.get(path)
    if (records.length > 1) {
      conflicts.push({ path, reason: "shared", records: records.map(recordOf) })
    } else if (isReservedPath(path) || records.some((each) => each.underReservedRoot)) {
      conflicts.push({ path, reason: "reserved_root", records: records.map(recordOf) })
    } else if (holder && key(holder) !== key(records[0] ?? { entity_type: "", entity_id: "" })) {
      conflicts.push({ path, reason: "taken", records: records.map(recordOf), holder })
    } else if (holder?.status !== "active") {
      // Its own reserved path is claimed back; a path nobody holds is claimed new
      const [only] = records
      if (only) {
        moves.push({ ...recordOf(only), path, replaced: only.replaced })
      }
    }
  }
  return {
    moves,
    conflicts: conflicts.slice(0, MAX_REPORTED_CONFLICTS),
    skipped: skipped.slice(0, MAX_REPORTED_CONFLICTS),
  }
}

const BATCH = 100

/**
 * Claims the new paths in batches, each all or none. Run again after a
 * failure, the plan finds the records already moved and leaves them.
 */
export async function movePaths(
  container: MedusaContainer,
  moves: readonly StyleMove[],
  progress: (done: number) => Promise<void>
): Promise<void> {
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  for (let start = 0; start < moves.length; start += BATCH) {
    await registry.claimPaths(
      moves.slice(start, start + BATCH).map(({ entity_type, entity_id, path, replaced }) => ({
        locale: CATALOG_LOCALE,
        entity_type,
        entity_id,
        path,
        replaced,
      }))
    )
    await progress(Math.min(moves.length, start + BATCH))
  }
}
