import "server-only"
import { cache } from "react"
import type {
  EntityType,
  PriceDisplay,
  Resolution,
  SeoPayload,
  SiteSeo,
  StoreCategory,
  StoreProduct,
  StoreRegion,
} from "@qticaret/types"
import { storeGet } from "./server"

/**
 * The Store API calls pages make (adr/0046), each one deduplicated within
 * a request by React's `cache` (metadata and the page share an answer).
 */

export interface SiteAnswer extends SiteSeo {
  shop: { name: string; logo_url: string | null }
  home: SeoPayload
}

export const resolvePath = cache((path: string) =>
  storeGet<Resolution>("/store/seo/resolve", { path })
)

export const siteSeo = cache(() => storeGet<SiteAnswer>("/store/seo/site"))

/** Storefront paths by record id; records without a live path are missing. */
export async function pathsOf(
  type: EntityType,
  ids: readonly string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(ids)]
  const found: Record<string, string> = {}
  for (let start = 0; start < unique.length; start += 100) {
    const chunk = unique.slice(start, start + 100)
    const { paths } = await storeGet<{ paths: Record<string, string> }>("/store/seo/paths", {
      type,
      id: chunk,
    })
    Object.assign(found, paths)
  }
  return found
}

let region: { value: StoreRegion; until: number } | undefined

/** The Turkish lira region every price is asked in (one region until F19). */
export async function liraRegion(): Promise<StoreRegion> {
  if (region && region.until > Date.now()) {
    return region.value
  }
  const { regions } = await storeGet<{ regions: StoreRegion[] }>("/store/regions", {
    fields: "id,name,currency_code",
    limit: 50,
  })
  const found = regions.find((each) => each.currency_code === "try")
  if (!found) {
    throw new Error("the backend has no Turkish lira region")
  }
  region = { value: found, until: Date.now() + 5 * 60 * 1000 }
  return found
}

const CARD_FIELDS = [
  "id",
  "title",
  "handle",
  "thumbnail",
  "brand.id",
  "brand.name",
  "brand.handle",
  "media_assets.id",
  "media_assets.url",
  "media_assets.width",
  "media_assets.height",
  "media_assets.alt",
  "media_assets.derivatives",
  "images.id",
  "images.url",
  "images.rank",
  "variants.id",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.inventory_quantity",
  "*variants.calculated_price",
]

const PAGE_FIELDS = [
  ...CARD_FIELDS,
  "subtitle",
  "description",
  "options.id",
  "options.title",
  "options.values.id",
  "options.values.value",
  "variants.title",
  "variants.sku",
  "variants.options.id",
  "variants.options.value",
  "variants.options.option_id",
]

export interface ProductQuery {
  ids?: readonly string[]
  categoryIds?: readonly string[]
  collectionIds?: readonly string[]
  /** Medusa's order: `-created_at` for the newest first. */
  order?: string
  limit: number
  offset?: number
}

export async function listProducts(
  query: ProductQuery
): Promise<{ products: StoreProduct[]; count: number }> {
  const { id: regionId } = await liraRegion()
  return storeGet<{ products: StoreProduct[]; count: number }>("/store/products", {
    region_id: regionId,
    fields: CARD_FIELDS.join(","),
    limit: query.limit,
    offset: query.offset ?? 0,
    order: query.order,
    id: query.ids,
    category_id: query.categoryIds,
    collection_id: query.collectionIds,
  })
}

export const productById = cache(async (id: string) => {
  const { id: regionId } = await liraRegion()
  const { product } = await storeGet<{ product: StoreProduct }>(
    `/store/products/${encodeURIComponent(id)}`,
    {
      region_id: regionId,
      fields: PAGE_FIELDS.join(","),
    }
  )
  return product
})

/**
 * Every live category (Medusa's store answer leaves out inactive and
 * internal ones), flat; the views build the tree. A shop with more than a
 * few hundred categories needs a menu of its own (D11).
 */
export const allCategories = cache(async () => {
  const { product_categories } = await storeGet<{ product_categories: StoreCategory[] }>(
    "/store/product-categories",
    { fields: "id,name,handle,description,parent_category_id,rank", limit: 100 }
  )
  return product_categories
})

/** The 30-day rule's prices by variant (F4.3), a hundred at a time. */
export async function priceDisplays(
  variantIds: readonly string[]
): Promise<Record<string, PriceDisplay>> {
  const unique = [...new Set(variantIds)]
  const found: Record<string, PriceDisplay> = {}
  for (let start = 0; start < unique.length; start += 100) {
    const { price_display } = await storeGet<{ price_display: Record<string, PriceDisplay> }>(
      "/store/price-display",
      { variant_id: unique.slice(start, start + 100), currency_code: "try" }
    )
    Object.assign(found, price_display)
  }
  return found
}

export const brandById = cache((id: string) =>
  storeGet<{ brand: { id: string; name: string; handle: string; description: string | null } }>(
    `/store/brands/${encodeURIComponent(id)}`
  )
)

export function productIdsOf(
  kind: "brands" | "landings",
  id: string,
  page: { limit: number; offset: number }
): Promise<{ product_ids: string[]; count: number }> {
  return storeGet(`/store/${kind}/${encodeURIComponent(id)}/products`, page)
}

export const landingById = cache((id: string) =>
  storeGet<{
    landing: { id: string; title: string; path: string; category_id: string; html: string | null }
  }>(`/store/landings/${encodeURIComponent(id)}`)
)

export const collectionById = cache((id: string) =>
  storeGet<{ collection: { id: string; title: string; handle: string } }>(
    `/store/collections/${encodeURIComponent(id)}`,
    { fields: "id,title,handle" }
  )
)
