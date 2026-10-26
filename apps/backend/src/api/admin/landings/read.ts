import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { containsPattern } from "../../../lib/security"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import type { LandingPageRecord } from "../../../modules/content/service"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../../../workflows/catalog/entity-paths"
import {
  BRAND_FACET_KEY,
  findFacet,
  landingProducts,
} from "../../../workflows/content/landing-facet"
import type { AdminGetLandingsType } from "./validators"

const LIST_FIELDS = [
  "id",
  "category_id",
  "facet_kind",
  "facet_key",
  "facet_value",
  "title",
  "handle",
  "status",
  "word_count",
  "originality",
  "reviewed_at",
  "published_at",
  "revised_at",
  "updated_at",
] as const

type Listed = Pick<LandingPageRecord, (typeof LIST_FIELDS)[number]>

/** The landing pages' active paths, by id (none while their category has none). */
async function pathsOf(container: MedusaContainer, ids: string[]): Promise<Map<string, string>> {
  const entries = ids.length
    ? await container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE).listUrlEntries(
        {
          locale: CATALOG_LOCALE,
          entity_type: CATALOG_ENTITY_TYPES.landing,
          entity_id: ids,
          status: "active",
        },
        { select: ["entity_id", "path"] }
      )
    : []
  return new Map(entries.map((entry) => [entry.entity_id, entry.path]))
}

const listed = (landing: Listed, path: string | null) => ({
  id: landing.id,
  category_id: landing.category_id,
  facet: { kind: landing.facet_kind, key: landing.facet_key, value: landing.facet_value },
  title: landing.title,
  handle: landing.handle,
  path,
  status: landing.status,
  word_count: landing.word_count,
  originality: landing.originality,
  reviewed_at: landing.reviewed_at,
  published_at: landing.published_at,
  revised_at: landing.revised_at,
  updated_at: landing.updated_at,
})

/** A page of landing pages by title, the most recently changed first; texts left out. */
export async function readLandings(container: MedusaContainer, query: AdminGetLandingsType) {
  const [rows, count] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listAndCountLandingPages(
      {
        ...(query.category_id ? { category_id: query.category_id } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.q ? { title: { $ilike: containsPattern(query.q) } } : {}),
      },
      {
        select: [...LIST_FIELDS],
        skip: query.offset,
        take: query.limit,
        order: { updated_at: "DESC" },
      }
    )
  const paths = await pathsOf(
    container,
    rows.map((row) => row.id)
  )
  return {
    landings: rows.map((row) => listed(row, paths.get(row.id) ?? null)),
    count,
    offset: query.offset,
    limit: query.limit,
  }
}

/**
 * One landing page with its text, its category's and facet's names (null
 * when gone since) and how many products it lists.
 */
export async function readLanding(container: MedusaContainer, id: string) {
  const [row] = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listLandingPages({ id }, { take: 1 })
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.landing_unknown")
  }
  const facet = { kind: row.facet_kind, key: row.facet_key, value: row.facet_value }
  const [paths, described, products, [category]] = await Promise.all([
    pathsOf(container, [id]),
    findFacet(container, facet),
    landingProducts(container, { category_id: row.category_id, facet }, { skip: 0, take: 1 }),
    container
      .resolve(Modules.PRODUCT)
      .listProductCategories({ id: row.category_id }, { select: ["name"], take: 1 }),
  ])
  return {
    ...listed(row, paths.get(id) ?? null),
    category: category ? { name: category.name } : null,
    facet: { ...facet, label: described?.label ?? null },
    body: row.body,
    product_count: products.count,
  }
}

interface FacetOption {
  value: string
  label: string
}

// Brands offered at most; a shop with more types to narrow the list (F3.17's picker)
const MAX_BRANDS = 500

/**
 * What a landing page can narrow its category by: the active brands, and
 * the options of filterable choice attributes, merged by key across
 * templates. The same facets a save accepts (`describeFacet`).
 */
export async function readLandingFacets(container: MedusaContainer) {
  const [brands, definitions] = await Promise.all([
    container
      .resolve<BrandsModuleService>(BRANDS_MODULE)
      .listBrands(
        { is_active: true },
        { select: ["id", "name"], order: { name: "ASC" }, take: MAX_BRANDS }
      ),
    container
      .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
      .listAttributeDefinitions(
        { is_filterable: true, type: ["select", "multi_select"] },
        { select: ["key", "label", "options"] }
      ),
  ])
  const attributes = new Map<
    string,
    { key: string; label: string; options: Map<string, FacetOption> }
  >()
  for (const definition of definitions) {
    const entry = attributes.get(definition.key) ?? {
      key: definition.key,
      label: definition.label,
      options: new Map<string, FacetOption>(),
    }
    for (const option of (definition.options ?? []) as unknown as FacetOption[]) {
      entry.options.set(option.value, option)
    }
    attributes.set(definition.key, entry)
  }
  return {
    brand: {
      key: BRAND_FACET_KEY,
      options: brands.map((brand) => ({ value: brand.id, label: brand.name })),
    },
    attributes: [...attributes.values()].map((entry) => ({
      key: entry.key,
      label: entry.label,
      options: [...entry.options.values()],
    })),
  }
}
