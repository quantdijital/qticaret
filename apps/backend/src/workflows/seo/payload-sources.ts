import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { landingProducts } from "../content/landing-facet"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { isSearchIndexingOn, parseEnv } from "../../lib/env"
import type { SeoOverrides, SeoShop, SeoSubject } from "../../lib/seo/resolve"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SeoSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { publicUploadUrl } from "../files/public-upload"
import { SALE_LISTING, saleProductIds } from "../pricing/sale-products"

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

// Read once: the environment does not change while the process runs
let indexing: boolean | undefined

export async function shopOf(container: MedusaContainer): Promise<SeoShop> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const seo = (await settings.getSection("seo")) as unknown as SeoSettings
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "store", fields: ["name"] })
  return {
    name: (data[0] as { name?: string | null } | undefined)?.name ?? "",
    canonicalHost: seo.canonical_host,
    indexing: (indexing ??= isSearchIndexingOn(parseEnv())),
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

/**
 * The share image: the page's own upload, else the main image (a file gone
 * since stands aside), else the shop's share image (F12.10).
 */
export async function imageOf(
  container: MedusaContainer,
  meta: SeoMetaRow | null | undefined,
  fallback: string | { url: string; alt: string | null } | null | undefined
): Promise<SeoSubject["image"]> {
  const own = meta?.og_image_override
    ? await publicUploadUrl(container, meta.og_image_override)
    : null
  if (own) {
    return { url: own, alt: meta?.og_image_alt ?? null }
  }
  if (fallback) {
    return typeof fallback === "string" ? { url: fallback, alt: null } : fallback
  }
  const shop = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("seo")) as unknown as SeoSettings
  return shop.default_og_image ? { url: shop.default_og_image, alt: null } : null
}

export interface MediaRow {
  url: string
  alt?: string | null
  derivatives?: { og?: { url: string } | null } | null
}

export const MEDIA_FIELDS = ["media_assets.url", "media_assets.alt", "media_assets.derivatives"]

/**
 * A product's main image as it is shared (F3.3): its 1200×630 crop when the
 * pipeline has made one, else the image itself, with its alt text.
 */
export function mainImageOf(
  thumbnail: string | null | undefined,
  media: (MediaRow | null)[] | null | undefined
): { url: string; alt: string | null } | null {
  if (!thumbnail) {
    return null
  }
  const asset = (media ?? []).find((row) => row?.url === thumbnail)
  return { url: asset?.derivatives?.og?.url ?? thumbnail, alt: asset?.alt ?? null }
}

// What a listing page shows first; its JSON-LD lists the same (F18 sorts alike)
export const LISTING_SIZE = 24

// The listed products of a landing page: its category and facet's, the newest first
async function landingListing(container: MedusaContainer, id: string): Promise<string[] | null> {
  const [landing] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listLandingPages(
      { id },
      { select: ["category_id", "facet_kind", "facet_key", "facet_value"], take: 1 }
    )
  if (!landing) {
    return null
  }
  const facet = { kind: landing.facet_kind, key: landing.facet_key, value: landing.facet_value }
  const listed = await landingProducts(
    container,
    { category_id: landing.category_id, facet },
    { skip: 0, take: LISTING_SIZE }
  )
  return listed.ids
}

// Which products a listing page shows, as product filters; null for no listing
async function listingFilters(
  container: MedusaContainer,
  owner: { entity_type: string; entity_id: string }
): Promise<Record<string, unknown> | null> {
  if (owner.entity_type === CATALOG_ENTITY_TYPES.category) {
    return { categories: { id: [owner.entity_id] } }
  }
  if (owner.entity_type === CATALOG_ENTITY_TYPES.collection) {
    return { collection_id: owner.entity_id }
  }
  if (owner.entity_type === CATALOG_ENTITY_TYPES.brand) {
    // Through the brand's side of the link: no link definition is loaded here
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "brand",
      fields: ["products.id"],
      filters: { id: owner.entity_id },
    })
    const brand = data[0] as { products?: ({ id: string } | null)[] | null } | undefined
    return { id: (brand?.products ?? []).flatMap((row) => (row ? [row.id] : [])) }
  }
  if (owner.entity_type === CATALOG_ENTITY_TYPES.landing) {
    const ids = await landingListing(container, owner.entity_id)
    return ids ? { id: ids } : null
  }
  // The products on sale now (`/kampanyalar`)
  if (owner.entity_type === SALE_LISTING) {
    const ids = await saleProductIds(container)
    return ids.length > 0 ? { id: ids } : null
  }
  return null
}

/**
 * The first published products of a category, brand, collection or
 * landing page, newest first, with their paths.
 */
export async function listingItems(
  container: MedusaContainer,
  owner: { entity_type: string; entity_id: string }
): Promise<{ name: string; path: string }[]> {
  const products = container.resolve(Modules.PRODUCT)
  const filters = await listingFilters(container, owner)
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
