import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import ProductBrandLink from "../../links/product-brand"
import type { SeoOverrides, SeoShop, SeoSubject } from "../../lib/seo/resolve"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SeoSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { publicUploadUrl } from "../files/public-upload"

/** What every page's `seo` object reads (adr/0015): its own fields, the shop, its trail and image. */

const OVERRIDE_FIELDS = [
  "seo_title",
  "seo_description",
  "canonical_override",
  "robots_override",
  "og_image_override",
  "og_image_alt",
]
export const SEO_FIELDS = OVERRIDE_FIELDS.map((field) => `seo_meta.${field}`)

export interface SeoMetaRow extends SeoOverrides {
  og_image_override: string | null
}

export interface CategoryRow {
  id: string
  name: string
  description?: string | null
  mpath?: string | null
  seo_meta?: SeoMetaRow | null
}

export async function rowOf<T>(
  container: MedusaContainer,
  entity: string,
  fields: string[],
  id: string
): Promise<T | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields, filters: { id } })
  return (data[0] as T | undefined) ?? null
}

export async function shopOf(container: MedusaContainer): Promise<SeoShop> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const seo = (await settings.getSection("seo")) as unknown as SeoSettings
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "store", fields: ["name"] })
  return {
    name: (data[0] as { name?: string | null } | undefined)?.name ?? "",
    canonicalHost: seo.canonical_host,
    titleTemplates: seo.title_templates,
    descriptionTemplates: seo.description_templates,
  }
}

/** Categories root first down to `last`, by `mpath`, with their active paths. */
export async function trailOf(container: MedusaContainer, last: CategoryRow, withLast: boolean) {
  const chain = (last.mpath ?? last.id).split(".")
  const ids = withLast ? chain : chain.slice(0, -1)
  if (ids.length === 0) {
    return []
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const [{ data }, entries] = await Promise.all([
    query.graph({ entity: "product_category", fields: ["id", "name"], filters: { id: ids } }),
    registry.listUrlEntries(
      {
        locale: CATALOG_LOCALE,
        entity_type: CATALOG_ENTITY_TYPES.category,
        entity_id: ids,
        status: "active",
      },
      { select: ["entity_id", "path"] }
    ),
  ])
  const names = new Map((data as { id: string; name: string }[]).map((row) => [row.id, row.name]))
  const paths = new Map(entries.map((entry) => [entry.entity_id, entry.path]))
  return ids.flatMap((id) => {
    const name = names.get(id)
    const path = paths.get(id)
    return name && path ? [{ name, path }] : []
  })
}

/** The share image: the page's own upload, else the main image (a file gone since stands aside). */
export async function imageOf(
  container: MedusaContainer,
  meta: SeoMetaRow | null | undefined,
  fallback: string | null | undefined
): Promise<SeoSubject["image"]> {
  const own = meta?.og_image_override
    ? await publicUploadUrl(container, meta.og_image_override)
    : null
  if (own) {
    return { url: own, alt: meta?.og_image_alt ?? null }
  }
  return fallback ? { url: fallback, alt: null } : null
}

// What a listing page shows first; its JSON-LD lists the same (F18 sorts alike)
export const LISTING_SIZE = 24

/** The first published products of a category, brand or collection, newest first, with their paths. */
export async function listingItems(
  container: MedusaContainer,
  owner: { entity_type: string; entity_id: string }
): Promise<{ name: string; path: string }[]> {
  const products = container.resolve(Modules.PRODUCT)
  let filters: Record<string, unknown> | null = null
  if (owner.entity_type === CATALOG_ENTITY_TYPES.category) {
    filters = { categories: { id: [owner.entity_id] } }
  } else if (owner.entity_type === CATALOG_ENTITY_TYPES.collection) {
    filters = { collection_id: owner.entity_id }
  } else if (owner.entity_type === CATALOG_ENTITY_TYPES.brand) {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: ProductBrandLink.entryPoint,
      fields: ["product_id"],
      filters: { brand_id: owner.entity_id },
    })
    filters = { id: (data as { product_id: string }[]).map((row) => row.product_id) }
  }
  if (!filters) {
    return []
  }
  const rows = await products.listProducts(
    { ...filters, status: "published" },
    { select: ["id", "title"], take: LISTING_SIZE, order: { created_at: "DESC" } }
  )
  if (rows.length === 0) {
    return []
  }
  const entries = await container
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .listUrlEntries(
      {
        locale: CATALOG_LOCALE,
        entity_type: CATALOG_ENTITY_TYPES.product,
        entity_id: rows.map((row) => row.id),
        status: "active",
      },
      { select: ["entity_id", "path"] }
    )
  const paths = new Map(entries.map((entry) => [entry.entity_id, entry.path]))
  return rows.flatMap((row) => {
    const path = paths.get(row.id)
    return path ? [{ name: row.title, path }] : []
  })
}
