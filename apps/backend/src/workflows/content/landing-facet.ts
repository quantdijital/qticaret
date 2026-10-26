import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ID_CHUNK, chunksOf } from "../../lib/catalog"
import { ValidationError } from "../../lib/errors"
import { LISTING_PARAMS } from "../../lib/seo/facets"
import { BRANDS_MODULE } from "../../modules/brands"
import type BrandsModuleService from "../../modules/brands/service"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"

/** What a landing page narrows its category by (docs/13 §7). */
export interface LandingFacet {
  kind: "brand" | "attribute"
  /** The attribute's key, or `marka` for a brand: the filter's parameter name (F3.17). */
  key: string
  /** The option's value, or the brand's id. */
  value: string
}

// Stored with each brand landing page: the listing's brand parameter (F3.17)
export const BRAND_FACET_KEY = LISTING_PARAMS.brand

interface FacetOption {
  value: string
  label: string
}

export interface FacetName {
  label: string
  /** What the page's handle comes from: the brand's handle, the option's value. */
  handle: string
}

/**
 * The facet's name: a brand that exists (`activeBrand`: one the shop
 * shows), or an option of a filterable choice attribute with this key in
 * some template; null when there is none.
 */
export async function findFacet(
  container: MedusaContainer,
  facet: LandingFacet,
  { activeBrand = false }: { activeBrand?: boolean } = {}
): Promise<FacetName | null> {
  if (facet.kind === "brand") {
    const [brand] =
      facet.key === BRAND_FACET_KEY
        ? await container
            .resolve<BrandsModuleService>(BRANDS_MODULE)
            .listBrands(
              { id: facet.value, ...(activeBrand ? { is_active: true } : {}) },
              { select: ["name", "handle"], take: 1 }
            )
        : []
    return brand ? { label: brand.name, handle: brand.handle } : null
  }
  const definitions = await container
    .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    .listAttributeDefinitions(
      { key: facet.key, is_filterable: true, type: ["select", "multi_select"] },
      { select: ["options"] }
    )
  const option = definitions
    .flatMap((definition) => (definition.options ?? []) as unknown as FacetOption[])
    .find((each) => each.value === facet.value)
  return option ? { label: option.label, handle: option.value } : null
}

/**
 * The facet's name, or the save refused: a page is made only for a facet
 * the panel offers (`GET /admin/landings/facets`), an active brand's too.
 */
export async function describeFacet(
  container: MedusaContainer,
  facet: LandingFacet
): Promise<FacetName> {
  const found = await findFacet(container, facet, { activeBrand: true })
  if (!found) {
    throw new ValidationError("content.landing_facet_unknown", { field: "facet" })
  }
  return found
}

/** The brands' products, from the brand's side of the link. */
export async function brandProductIds(
  container: MedusaContainer,
  brandIds: string[]
): Promise<string[]> {
  if (brandIds.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "brand",
    fields: ["products.id"],
    filters: { id: brandIds },
  })
  const brands = data as { products?: ({ id: string } | null)[] | null }[]
  return [
    ...new Set(brands.flatMap((brand) => (brand.products ?? []).flatMap((row) => row?.id ?? []))),
  ]
}

/** The products holding any of these options of the attribute, in two queries. */
export async function optionProductIds(
  container: MedusaContainer,
  key: string,
  options: string[]
): Promise<string[]> {
  const values = await container
    .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    .valuesWithOptions(key, options)
  const products = new Set<string>()
  for (const ids of chunksOf(values)) {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "attribute_value",
      fields: ["product.id"],
      filters: { id: ids },
    })
    for (const row of data as { product?: { id: string } | null }[]) {
      if (row.product) {
        products.add(row.product.id)
      }
    }
  }
  return [...products]
}

/**
 * Products that have the facet, in any category. Read from the brand's and
 * the value's side of their links: importing a link definition here would
 * define it wherever this file is loaded (tests too).
 */
export const facetProductIds = (container: MedusaContainer, facet: LandingFacet) =>
  facet.kind === "brand"
    ? brandProductIds(container, [facet.value])
    : optionProductIds(container, facet.key, [facet.value])

export interface CategoryRow {
  id: string
  mpath?: string | null
  is_active?: boolean | null
  is_internal?: boolean | null
}

const shown = (category: CategoryRow) =>
  category.is_active === true && category.is_internal !== true

/** Every category, with its place in the tree (shops keep hundreds at most). */
export async function categoryRows(container: MedusaContainer): Promise<CategoryRow[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "mpath", "is_active", "is_internal"],
  })
  return data
}

/**
 * The category and every category below it. `live`: only those the shop
 * shows, each with every category between it and the root shown too.
 */
export function subtreeIn(rows: readonly CategoryRow[], rootId: string, live: boolean): string[] {
  const visible = new Set(rows.filter(shown).map((row) => row.id))
  return rows
    .filter((row) => {
      const chain = (row.mpath ?? row.id).split(".")
      const at = chain.indexOf(rootId)
      return at >= 0 && (!live || chain.slice(at + 1).every((id) => visible.has(id)))
    })
    .map((row) => row.id)
}

/** The categories the shop shows: active, not internal. */
export async function liveCategoryIds(container: MedusaContainer): Promise<string[]> {
  return (await categoryRows(container)).filter(shown).map((row) => row.id)
}

/** What a live landing page matches: published, its category shown (sitemap, IndexNow, suggestions). */
export async function liveLandingFilters(
  container: MedusaContainer
): Promise<Record<string, unknown>> {
  return { status: "published", category_id: await liveCategoryIds(container) }
}

/**
 * A landing page's products: published, in its category or a shown one
 * below, with its facet; the newest first. What its listing and its count
 * show. A facet with more products than one query takes is read in parts
 * and paged here.
 */
export async function landingProducts(
  container: MedusaContainer,
  landing: { category_id: string; facet: LandingFacet },
  page: { skip: number; take: number }
): Promise<{ ids: string[]; count: number }> {
  const [ids, rows] = await Promise.all([
    facetProductIds(container, landing.facet),
    categoryRows(container),
  ])
  const categories = subtreeIn(rows, landing.category_id, true)
  if (ids.length === 0 || categories.length === 0) {
    return { ids: [], count: 0 }
  }
  const products = container.resolve(Modules.PRODUCT)
  const filters = { categories: { id: categories }, status: "published" as const }
  if (ids.length <= ID_CHUNK) {
    const [found, count] = await products.listAndCountProducts(
      { ...filters, id: ids },
      { select: ["id"], skip: page.skip, take: page.take, order: { created_at: "DESC", id: "ASC" } }
    )
    return { ids: found.map((product) => product.id), count }
  }
  const found: { id: string; created_at: Date | string }[] = []
  for (const chunk of chunksOf(ids)) {
    found.push(
      ...(await products.listProducts({ ...filters, id: chunk }, { select: ["id", "created_at"] }))
    )
  }
  found.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
      a.id.localeCompare(b.id)
  )
  return {
    ids: found.slice(page.skip, page.skip + page.take).map((product) => product.id),
    count: found.length,
  }
}
