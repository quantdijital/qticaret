import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError, isValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { brandPath, categoryPath, collectionPath, isValidSlug, productPath } from "../../lib/seo"
import type { UrlStyle } from "../../lib/seo"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SeoSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import type { ClaimInput, PathClaim } from "../../modules/url-registry/service"

/**
 * Storefront paths of products, categories and collections in the URL
 * registry (F3.1, docs/13 §2): the workflow hooks claim a record's path
 * after every create and update, in one transaction (all or none).
 * - A record that already holds the path its handle gives, in either URL
 *   style, is left alone: a style change moves every path at once (F3 T4)
 *   and does not block unrelated edits.
 * - A changed handle leaves the old path reserved for its redirect (T3),
 *   unless the product is unpublished: its URL was not public, so the slug
 *   is given up for other records.
 * - A path another record holds refuses the save (`seo.path_taken`).
 */

// One language until F19 (DEFAULT_LOCALE in packages/types)
export const CATALOG_LOCALE = "tr"
const LOCALE = CATALOG_LOCALE
const STYLES: readonly UrlStyle[] = ["prefixed", "flat"]

export const CATALOG_ENTITY_TYPES = {
  product: "product",
  category: "product_category",
  collection: "product_collection",
  brand: "brand",
  // F3.16: content pages, blog posts and facet landing pages
  page: "page",
  post: "post",
  landing: "landing",
  // Blog archives (adr/0019 ek 2026-11-03)
  post_category: "post_category",
  post_tag: "post_tag",
} as const

interface Handled {
  id: string
  handle?: string | null
}

export interface Wanted {
  entity_type: string
  entity_id: string
  /** The path in the shop's current style, and every form that already counts. */
  path: string
  accepted: string[]
  replaced?: ClaimInput["replaced"]
}

function handleOf(record: Handled): string {
  const handle = record.handle
  if (typeof handle !== "string" || !isValidSlug(handle)) {
    // Imports skip the handle middleware; their Medusa-made handles keep Turkish letters
    throw new ValidationError("catalog.handle_invalid", { field: "handle" })
  }
  return handle
}

async function urlStyle(container: MedusaContainer): Promise<SeoSettings["url_style"]> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  return ((await settings.getSection("seo")) as unknown as SeoSettings).url_style
}

async function rows<T>(
  container: MedusaContainer,
  entity: string,
  fields: string[],
  filters: Record<string, unknown>
): Promise<T[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields, filters })
  return data as T[]
}

/** Claims the paths records do not hold yet, all in one transaction. */
export async function claimMissing(
  container: MedusaContainer,
  wanted: Wanted[]
): Promise<PathClaim[]> {
  if (wanted.length === 0) {
    return []
  }
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const held = await registry.listUrlEntries(
    {
      locale: LOCALE,
      entity_type: [...new Set(wanted.map((item) => item.entity_type))],
      entity_id: wanted.map((item) => item.entity_id),
      status: "active",
    },
    { select: ["entity_type", "entity_id", "path"] }
  )
  const holds = new Set(
    held.map((entry) => `${entry.entity_type}|${entry.entity_id}|${entry.path}`)
  )
  const missing = wanted.filter(
    (item) =>
      !item.accepted.some((path) => holds.has(`${item.entity_type}|${item.entity_id}|${path}`))
  )
  return registry.claimPaths(
    missing.map(({ entity_type, entity_id, path, replaced }) => ({
      locale: LOCALE,
      entity_type,
      entity_id,
      path,
      ...(replaced ? { replaced } : {}),
    }))
  )
}

/** Undoes claims, newest first (a hook's compensation). */
export async function unclaimPaths(container: MedusaContainer, claims: PathClaim[]): Promise<void> {
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  for (const claim of [...claims].reverse()) {
    await registry.unclaimPath(claim)
  }
}

export async function claimProductPaths(
  container: MedusaContainer,
  ids: string[]
): Promise<PathClaim[]> {
  if (ids.length === 0) {
    return []
  }
  const [style, products] = await Promise.all([
    urlStyle(container),
    rows<Handled & { status: string }>(container, "product", ["id", "handle", "status"], {
      id: ids,
    }),
  ])
  return claimMissing(
    container,
    products.map((product) => {
      const handle = handleOf(product)
      return {
        entity_type: CATALOG_ENTITY_TYPES.product,
        entity_id: product.id,
        path: productPath(handle, style.product),
        accepted: STYLES.map((each) => productPath(handle, each)),
        replaced: product.status === "published" ? "reserve" : "free",
      }
    })
  )
}

interface CategoryRow extends Handled {
  mpath?: string | null
}

// `mpath` lists the category's ancestors' IDs and its own, root first
const chainOf = (category: CategoryRow): string[] => (category.mpath ?? category.id).split(".")

function categoryWanted(
  category: CategoryRow,
  byId: Map<string, CategoryRow>,
  style: UrlStyle
): Wanted {
  const handles = chainOf(category).map((id) => {
    const ancestor = byId.get(id)
    if (!ancestor) {
      throw new Error(`category ${category.id} names an ancestor that is not there`)
    }
    return handleOf(ancestor)
  })
  return {
    entity_type: CATALOG_ENTITY_TYPES.category,
    entity_id: category.id,
    path: categoryPath(handles, style),
    accepted: STYLES.map((each) => categoryPath(handles, each)),
  }
}

/**
 * Claims the categories' paths, and with `subtree` (the default) their
 * descendants': a prefixed category URL carries the tree, so renaming or
 * moving one changes every path below it. A descendant whose path cannot be
 * made (a handle from before F3.1) is skipped and logged, since the save
 * did not touch it.
 */
export async function claimCategoryPaths(
  container: MedusaContainer,
  ids: string[],
  { subtree = true }: { subtree?: boolean } = {}
): Promise<PathClaim[]> {
  if (ids.length === 0) {
    return []
  }
  // Shops keep hundreds of categories at most; all of them answer the tree questions
  const [style, categories] = await Promise.all([
    urlStyle(container),
    rows<CategoryRow>(container, "product_category", ["id", "handle", "mpath"], {}),
  ])
  const byId = new Map(categories.map((category) => [category.id, category]))
  const direct = new Set(ids)
  const wanted: Wanted[] = []
  for (const category of categories) {
    const below = subtree && chainOf(category).some((id) => direct.has(id))
    if (!direct.has(category.id) && !below) {
      continue
    }
    try {
      wanted.push(categoryWanted(category, byId, style.category))
    } catch (error) {
      if (direct.has(category.id) || !isValidationError(error)) {
        throw error
      }
      logger.warn({ event: "catalog.category_path_skipped", categoryId: category.id })
    }
  }
  return claimMissing(container, wanted)
}

export async function claimCollectionPaths(
  container: MedusaContainer,
  ids: string[]
): Promise<PathClaim[]> {
  if (ids.length === 0) {
    return []
  }
  const collections = await rows<Handled>(container, "product_collection", ["id", "handle"], {
    id: ids,
  })
  return claimMissing(
    container,
    collections.map((collection) => {
      const path = collectionPath(handleOf(collection))
      return {
        entity_type: CATALOG_ENTITY_TYPES.collection,
        entity_id: collection.id,
        path,
        accepted: [path],
      }
    })
  )
}

/**
 * Claims the brands' paths (F3.11) in the shop's brand URL style. An
 * inactive brand's page was not public: a renamed handle frees its old
 * slug instead of reserving it.
 */
export async function claimBrandPaths(
  container: MedusaContainer,
  brands: { id: string; handle: string; is_active: boolean }[]
): Promise<PathClaim[]> {
  if (brands.length === 0) {
    return []
  }
  const style = await urlStyle(container)
  return claimMissing(
    container,
    brands.map((brand) => {
      const handle = handleOf(brand)
      return {
        entity_type: CATALOG_ENTITY_TYPES.brand,
        entity_id: brand.id,
        path: brandPath(handle, style.brand),
        accepted: STYLES.map((each) => brandPath(handle, each)),
        replaced: brand.is_active ? "reserve" : "free",
      }
    })
  )
}
