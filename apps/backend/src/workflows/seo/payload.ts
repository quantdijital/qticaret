import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SHORT_EXCERPT, excerpt, priceSentence, resolveSeoPayload } from "../../lib/seo/resolve"
import type { SeoOverrides, SeoPayload, SeoShop, SeoSubject } from "../../lib/seo/resolve"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { SeoSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import type { UrlOwner } from "../../modules/url-registry/validation"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { publicUploadUrl } from "../files/public-upload"
import { highlightText } from "./highlight"
import type { HighlightValue } from "./highlight"

/**
 * Loads what a page's `seo` object needs (adr/0015) and builds it with
 * `lib/seo/resolve`: the record, its own SEO fields, the shop's settings,
 * its trail of categories and its share image.
 */

const OVERRIDE_FIELDS = [
  "seo_title",
  "seo_description",
  "canonical_override",
  "robots_override",
  "og_image_override",
  "og_image_alt",
]
const SEO_FIELDS = OVERRIDE_FIELDS.map((field) => `seo_meta.${field}`)

interface SeoMetaRow extends SeoOverrides {
  og_image_override: string | null
}

interface CategoryRow {
  id: string
  name: string
  description?: string | null
  mpath?: string | null
  seo_meta?: SeoMetaRow | null
}

interface ProductRow {
  id: string
  title: string
  subtitle?: string | null
  description?: string | null
  thumbnail?: string | null
  categories?: (CategoryRow | null)[] | null
  product_extension?: { primary_category_id?: string | null } | null
  variants?: ({ prices?: PriceRow[] | null } | null)[] | null
  attribute_values?: (HighlightValue | null)[] | null
  brand?: { name: string } | null
  seo_meta?: SeoMetaRow | null
}

interface PriceRow {
  amount?: unknown
  currency_code?: string | null
  price_list_id?: string | null
}

async function rowOf<T>(
  container: MedusaContainer,
  entity: string,
  fields: string[],
  id: string
): Promise<T | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields, filters: { id } })
  return (data[0] as T | undefined) ?? null
}

async function shopOf(container: MedusaContainer): Promise<SeoShop> {
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
async function trailOf(container: MedusaContainer, last: CategoryRow, withLast: boolean) {
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
async function imageOf(
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

// The primary category, else the deepest one the product is in (docs/13 §2.2)
function primaryCategory(product: ProductRow): CategoryRow | null {
  const categories = (product.categories ?? []).filter((row): row is CategoryRow => row !== null)
  const chosen = product.product_extension?.primary_category_id
  const depth = (row: CategoryRow) => (row.mpath ?? "").split(".").length
  return (
    categories.find((row) => row.id === chosen) ??
    [...categories].sort((a, b) => depth(b) - depth(a))[0] ??
    null
  )
}

function lirasOf(product: ProductRow): number[] {
  return (product.variants ?? []).flatMap((variant) =>
    (variant?.prices ?? []).flatMap((price) =>
      price.currency_code?.toLowerCase() === "try" && !price.price_list_id
        ? [Number(price.amount)]
        : []
    )
  )
}

async function productSubject(container: MedusaContainer, id: string, path: string) {
  const product = await rowOf<ProductRow>(
    container,
    "product",
    [
      "id",
      "title",
      "subtitle",
      "description",
      "thumbnail",
      "categories.id",
      "categories.name",
      "categories.mpath",
      "product_extension.primary_category_id",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.prices.price_list_id",
      "attribute_values.*",
      "attribute_values.definition.*",
      "brand.name",
      ...SEO_FIELDS,
    ],
    id
  )
  if (!product) {
    return null
  }
  const category = primaryCategory(product)
  const description = product.description ?? ""
  const subtitle = product.subtitle?.trim() ?? ""
  const subject: SeoSubject = {
    kind: "product",
    path,
    name: product.title,
    description,
    tokens: {
      kategori: category?.name ?? null,
      kısa_açıklama: subtitle !== "" ? subtitle : excerpt(description, SHORT_EXCERPT),
      fiyat_cümlesi: priceSentence(lirasOf(product)),
      öne_çıkan_attribute: highlightText(product.attribute_values ?? []),
      marka: product.brand?.name ?? null,
      // Shipping offers (F7) fill this
      kargo_cümlesi: null,
    },
    overrides: product.seo_meta ?? null,
    image: await imageOf(container, product.seo_meta, product.thumbnail),
    trail: category ? await trailOf(container, category, true) : [],
  }
  return subject
}

async function categorySubject(container: MedusaContainer, id: string, path: string) {
  const category = await rowOf<CategoryRow>(
    container,
    "product_category",
    ["id", "name", "description", "mpath", ...SEO_FIELDS],
    id
  )
  if (!category) {
    return null
  }
  const subject: SeoSubject = {
    kind: "category",
    path,
    name: category.name,
    description: category.description ?? "",
    tokens: {},
    overrides: category.seo_meta ?? null,
    image: await imageOf(container, category.seo_meta, null),
    trail: await trailOf(container, category, false),
  }
  return subject
}

async function collectionSubject(container: MedusaContainer, id: string, path: string) {
  const collection = await rowOf<{ id: string; title: string; seo_meta?: SeoMetaRow | null }>(
    container,
    "product_collection",
    ["id", "title", ...SEO_FIELDS],
    id
  )
  if (!collection) {
    return null
  }
  const subject: SeoSubject = {
    kind: "collection",
    path,
    name: collection.title,
    description: "",
    tokens: {},
    overrides: collection.seo_meta ?? null,
    image: await imageOf(container, collection.seo_meta, null),
    trail: [],
  }
  return subject
}

async function brandSubject(container: MedusaContainer, id: string, path: string) {
  const brand = await rowOf<{
    id: string
    name: string
    description?: string | null
    logo_url?: string | null
    seo_meta?: SeoMetaRow | null
  }>(container, "brand", ["id", "name", "description", "logo_url", ...SEO_FIELDS], id)
  if (!brand) {
    return null
  }
  const subject: SeoSubject = {
    kind: "brand",
    path,
    name: brand.name,
    description: brand.description ?? "",
    tokens: {},
    overrides: brand.seo_meta ?? null,
    image: await imageOf(container, brand.seo_meta, brand.logo_url),
    trail: [],
  }
  return subject
}

const SUBJECTS: Readonly<
  Record<
    string,
    (container: MedusaContainer, id: string, path: string) => Promise<SeoSubject | null>
  >
> = {
  [CATALOG_ENTITY_TYPES.product]: productSubject,
  [CATALOG_ENTITY_TYPES.category]: categorySubject,
  [CATALOG_ENTITY_TYPES.collection]: collectionSubject,
  [CATALOG_ENTITY_TYPES.brand]: brandSubject,
}

/** The `seo` object of a live page at `path`, or null for a kind without one. */
export async function seoPayloadFor(
  container: MedusaContainer,
  owner: UrlOwner,
  path: string
): Promise<SeoPayload | null> {
  const load = Object.hasOwn(SUBJECTS, owner.entity_type) ? SUBJECTS[owner.entity_type] : undefined
  if (!load) {
    return null
  }
  const [subject, shop] = await Promise.all([
    load(container, owner.entity_id, path),
    shopOf(container),
  ])
  return subject ? resolveSeoPayload(subject, shop) : null
}
