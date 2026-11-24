import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BRANDS_MODULE } from "../../modules/brands"
import type BrandsModuleService from "../../modules/brands/service"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { POPUPS_MODULE } from "../../modules/popups"
import type PopupsModuleService from "../../modules/popups/service"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/** Where a library image can be in use; the panel names each. */
export type MediaUseKind =
  | "product"
  | "product_description"
  | "brand"
  | "content"
  | "landing"
  | "bulk_message"
  | "storefront"
  | "logo"
  | "share_image"
  | "seo"
  | "order"
  // adr/0046 Ek 2026-11-04: a category's picture, the footer's ETBİS QR code
  | "category"
  | "etbis_qr"
  // The storefront's site icon (appearance `favicon_url`)
  | "favicon"
  // adr/0064: a saved look (its id; `label` its name, null for an automatic save)
  | "storefront_design"
  // A collection's picture (Ürünler > Koleksiyonlar)
  | "collection"
  // adr/0080: a storefront pop-up's picture (its id; `label` its name)
  | "popup"

export interface MediaUse {
  kind: MediaUseKind
  /** The record to open, where there is one. */
  id: string | null
  label: string | null
}

export interface MediaTarget {
  id: string
  url: string
  file_id: string | null
}

// Enough to say where; the delete is refused at the first anyway
const LIMIT = 10

type Container = Pick<MedusaContainer, "resolve">

interface Named {
  id: string
  title?: string | null
  name?: string | null
}

const uses = (kind: MediaUseKind, rows: readonly Named[]): MediaUse[] =>
  rows.map((row) => ({ kind, id: row.id, label: row.title ?? row.name ?? null }))

/** Products showing it: linked to its record, among their images, or as the thumbnail. */
async function products(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: linked }, { data: images }, { data: thumbnails }] = await Promise.all([
    query.graph({
      entity: "media_asset",
      fields: ["product.id", "product.title"],
      filters: { id: target.id },
    }),
    query.graph({
      entity: "product_image",
      fields: ["product.id", "product.title"],
      filters: { url: target.url },
      pagination: { take: LIMIT },
    }),
    query.graph({
      entity: "product",
      fields: ["id", "title"],
      filters: { thumbnail: target.url },
      pagination: { take: LIMIT },
    }),
  ])
  const found = new Map<string, Named>()
  for (const row of [...linked, ...images] as { product?: Named | null }[]) {
    if (row.product) {
      found.set(row.product.id, row.product)
    }
  }
  for (const row of thumbnails as Named[]) {
    found.set(row.id, row)
  }
  return uses("product", [...found.values()].slice(0, LIMIT))
}

async function brands(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
  const rows = await service.listBrands(
    {
      $or: [
        { logo_url: target.url },
        ...(target.file_id ? [{ logo_file_id: target.file_id }] : []),
      ],
    },
    { select: ["id", "name"], take: LIMIT }
  )
  return uses("brand", rows)
}

/** A page's own share image (adr/0015) holds the file's id. */
async function seoImages(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  if (!target.file_id) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "seo_meta",
    fields: ["id", "entity_type"],
    filters: { og_image_override: target.file_id },
    pagination: { take: LIMIT },
  })
  return (data as { id: string; entity_type: string }[]).map((row) => ({
    kind: "seo",
    id: row.id,
    label: row.entity_type,
  }))
}

/** The shop's logos and site icon (appearance), its share image (seo) and its ETBİS QR code (store). */
async function settings(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [appearance, seo, store] = (await Promise.all([
    service.getSection("appearance"),
    service.getSection("seo"),
    service.getSection("store"),
  ])) as unknown as [
    { logo_light_url?: string | null; logo_dark_url?: string | null; favicon_url?: string | null },
    { default_og_image?: string | null },
    { etbis_qr_url?: string | null },
  ]
  return [
    ...(appearance.logo_light_url === target.url || appearance.logo_dark_url === target.url
      ? [{ kind: "logo" as const, id: null, label: null }]
      : []),
    ...(appearance.favicon_url === target.url
      ? [{ kind: "favicon" as const, id: null, label: null }]
      : []),
    ...(seo.default_og_image === target.url
      ? [{ kind: "share_image" as const, id: null, label: null }]
      : []),
    ...(store.etbis_qr_url === target.url
      ? [{ kind: "etbis_qr" as const, id: null, label: null }]
      : []),
  ]
}

/** Categories showing it as their picture (adr/0046 Ek 2026-11-04), by name. */
async function categories(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  const rows = await container
    .resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
    .listCategoryImages({ url: target.url }, { select: ["category_id"], take: LIMIT })
  if (rows.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "name"],
    filters: { id: rows.map((row) => row.category_id) },
  })
  const names = new Map((data as Named[]).map((row) => [row.id, row.name ?? null]))
  return rows.map((row) => ({
    kind: "category",
    id: row.category_id,
    label: names.get(row.category_id) ?? null,
  }))
}

/** Collections showing it as their picture, by title, through their row's link. */
async function collections(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  const rows = await container
    .resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
    .listCollectionExtensions({ image_url: target.url }, { select: ["id"], take: LIMIT })
  if (rows.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "collection_extension",
    fields: ["product_collection.id", "product_collection.title"],
    filters: { id: rows.map((row) => row.id) },
  })
  return (data as { product_collection?: Named | null }[]).flatMap((row) =>
    row.product_collection ? uses("collection", [row.product_collection]) : []
  )
}

/** Pop-ups showing it (adr/0080), by name; a deleted one holds nothing. */
async function popups(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  const rows = await container
    .resolve<PopupsModuleService>(POPUPS_MODULE)
    .listPopups({ image_url: target.url }, { select: ["id", "name"], take: LIMIT })
  return uses("popup", rows)
}

/**
 * Documents holding the address as one of their values: pages and posts,
 * landing pages, bulk messages, the storefront's design (draft and live), its
 * saved looks (adr/0064: applying one must find its images)
 * and products' descriptions. Read straight from their tables, read only:
 * no module can search inside a JSON document, and an address is a whole
 * string there (`"https://…"`), so its quoted form matches only itself.
 */
async function documents(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const quoted = JSON.stringify(target.url)
  const holds = (column: string) => knex.raw("position(? in ??::text) > 0", [quoted, column])
  const [entries, landings, messages, layouts, designs, descriptions] = await Promise.all([
    knex("content_entry")
      .select("id", "title")
      .whereNull("deleted_at")
      .andWhereRaw("(image_url = ? or position(? in body::text) > 0)", [target.url, quoted])
      .limit(LIMIT) as Promise<Named[]>,
    knex("landing_page")
      .select("id", "title")
      .whereNull("deleted_at")
      .andWhere(holds("body"))
      .limit(LIMIT) as Promise<Named[]>,
    knex("bulk_message")
      .select("id", "name")
      .whereNull("deleted_at")
      .andWhere(holds("body"))
      .limit(LIMIT) as Promise<Named[]>,
    knex("storefront_layout")
      .select("id")
      .whereNull("deleted_at")
      .andWhereRaw(
        "(position(? in draft::text) > 0 or position(? in coalesce(published::text, '')) > 0)",
        [quoted, quoted]
      )
      .limit(1) as Promise<Named[]>,
    knex("storefront_design")
      .select("id", "name")
      .whereNull("deleted_at")
      .andWhere(holds("document"))
      .limit(LIMIT) as Promise<Named[]>,
    knex("product_extension")
      .select("id")
      .whereNull("deleted_at")
      .andWhere(holds("description_doc"))
      .limit(LIMIT) as Promise<Named[]>,
  ])
  return [
    ...uses("content", entries),
    ...uses("landing", landings),
    ...uses("bulk_message", messages),
    ...layouts.map(() => ({ kind: "storefront" as const, id: null, label: null })),
    ...uses("storefront_design", designs),
    ...(await describedProducts(
      container,
      descriptions.map((row) => row.id)
    )),
  ]
}

/** The products whose description documents show it, through their extension's link. */
async function describedProducts(container: Container, ids: string[]): Promise<MediaUse[]> {
  if (ids.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_extension",
    fields: ["product.id", "product.title"],
    filters: { id: ids },
  })
  return (data as { product?: Named | null }[]).flatMap((row) =>
    row.product ? uses("product_description", [row.product]) : []
  )
}

/** Orders placed with it as a line's picture: their pages and e-mails show it for good. */
async function orders(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const row = (await knex("order_line_item")
    .first("id")
    .where("thumbnail", target.url)
    .whereNull("deleted_at")) as { id: string } | undefined
  return row ? [{ kind: "order", id: null, label: null }] : []
}

/**
 * Everywhere the shop shows the image: what keeps it from being deleted
 * (docs/06 Ortam kütüphanesi) and what its detail lists.
 */
export async function mediaUses(container: Container, target: MediaTarget): Promise<MediaUse[]> {
  const found = await Promise.all([
    products(container, target),
    documents(container, target),
    brands(container, target),
    seoImages(container, target),
    settings(container, target),
    categories(container, target),
    collections(container, target),
    popups(container, target),
    orders(container, target),
  ])
  return found.flat()
}
