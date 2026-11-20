import "server-only"
import { cache } from "react"
import type {
  EntityType,
  LegalIdentity,
  PriceDisplay,
  Resolution,
  SeoPayload,
  SiteSeo,
  StoreBrandSummary,
  StoreCategory,
  StoreProduct,
  StoreProductReviews,
  StoreRegion,
  StoreLayout,
  StoreMenu,
  StorefrontAnswer,
} from "@qticaret/types"
import { currentWholesale } from "../account/wholesale"
import type { SiteIcon } from "../seo/icons"
import type { LogoSource } from "../views/footer-logo"
import { isStoreApiError } from "./errors"
import { keepResolution, keptResolution } from "./resolutions"
import { storeGet, storePublicGet } from "./server"
import { wholesaleDisplays } from "./wholesale-prices"

/**
 * The Store API calls pages make (adr/0046), each one deduplicated within
 * a request by React's `cache` (metadata and the page share an answer).
 */

export interface SiteAnswer extends SiteSeo {
  /**
   * The site icon's fields: none from a backend before it (`lib/seo/icons.ts`);
   * the store profile's two logos with their sizes (`logos`), none before them.
   */
  shop: LogoSource & SiteIcon
  home: SeoPayload
}

/** A path's answer; the proxy's, when it resolved the same path seconds ago (`resolutions.ts`). */
export const resolvePath = cache(async (path: string): Promise<Resolution> => {
  const kept = keptResolution(path)
  if (kept) {
    return kept
  }
  const answer = await storeGet<Resolution>("/store/seo/resolve", { path })
  keepResolution(path, answer)
  return answer
})

export const siteSeo = cache(() => storePublicGet<SiteAnswer>("/store/seo/site"))

/** The frame the shop wrote (announcement bar, links, footer, trust strip) and its free shipping threshold (D3). */
export const storefrontSettings = cache(() => storePublicGet<StorefrontAnswer>("/store/storefront"))

/** The shop's published design (adr/0049): the sections showing now, resolved. */
export const storefrontLayout = cache(async () => {
  const { layout } = await storePublicGet<{ layout: StoreLayout }>("/store/storefront-layout")
  return layout
})

/** The design's draft for a signed preview link; null when the link does not open (a 404). */
export const layoutPreview = cache(async (token: string): Promise<StoreLayout | null> => {
  try {
    const { layout } = await storeGet<{ layout: StoreLayout }>(
      `/store/storefront-layout/preview/${encodeURIComponent(token)}`
    )
    return layout
  } catch (error) {
    if (isStoreApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
})

/** The theme editor's live session (adr/0065 §1): the draft as last saved and its edition; null: ended. */
export const layoutSession = cache(
  async (token: string): Promise<{ layout: StoreLayout; edition: string | null } | null> => {
    try {
      const answer = await storeGet<{ layout: StoreLayout; edition?: string }>(
        `/store/storefront-layout/session/${encodeURIComponent(token)}`
      )
      return { layout: answer.layout, edition: answer.edition ?? null }
    } catch (error) {
      if (isStoreApiError(error) && error.status === 404) {
        return null
      }
      throw error
    }
  }
)

/** The shop's menus (adr/0049): links named and placed as their records are now. */
export const storefrontMenus = cache(async () => {
  const { menus } = await storePublicGet<{ menus: StoreMenu[] }>("/store/storefront-menus")
  return menus
})

/** The shop's legal identity and contact details, for the footer (F13.9). */
export const legalIdentity = cache(async () => {
  const { identity } = await storePublicGet<{ identity: LegalIdentity }>("/store/legal-identity")
  return identity
})

/** Storefront paths by record id; records without a live path are missing. */
export async function pathsOf(
  type: EntityType,
  ids: readonly string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(ids)]
  const found: Record<string, string> = {}
  for (let start = 0; start < unique.length; start += 100) {
    const chunk = unique.slice(start, start + 100)
    const { paths } = await storePublicGet<{ paths: Record<string, string> }>("/store/seo/paths", {
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
  // A framed card's free shipping line is for a product the shop ships (adr/0049 §3.3)
  "product_extension.kind",
  "product_extension.is_gift_card",
  "variants.id",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.inventory_quantity",
  "*variants.calculated_price",
]

const PAGE_FIELDS = [
  ...CARD_FIELDS,
  // The related rails' category (W-02): asked as `categories.id` the store answers
  // each category as `{ is_internal }` only, so the whole category is asked for
  "*categories",
  "subtitle",
  "description",
  "options.id",
  "options.title",
  "options.values.id",
  "options.values.value",
  // Which variants each picture shows with: the gallery follows the choice (owner 2026-11-05)
  "images.variants.id",
  // Its videos in the gallery (adr/0069 §6): the backend's leaves one by one; it sends
  // the ready ones only, and none while the shop's videos are off
  "media_videos.id",
  "media_videos.kind",
  "media_videos.status",
  "media_videos.title",
  "media_videos.position",
  "media_videos.width",
  "media_videos.height",
  "media_videos.duration_ms",
  "media_videos.outputs",
  "media_videos.poster",
  "media_videos.youtube_id",
  "variants.title",
  "variants.sku",
  "variants.options.id",
  "variants.options.value",
  "variants.options.option_id",
  // Public attributes only: the backend never answers the shop's own notes (adr/0013 T5)
  "attribute_values.id",
  "attribute_values.value_text",
  "attribute_values.value_number",
  "attribute_values.value_boolean",
  "attribute_values.value_options",
  "attribute_values.definition.key",
  "attribute_values.definition.label",
  "attribute_values.definition.type",
  "attribute_values.definition.unit",
  "attribute_values.definition.rank",
  "attribute_values.definition.options",
  "attribute_values.definition.is_seo_highlight",
  // The spec table's sections (adr/0013 Ek 2026-11-04)
  "attribute_values.definition.group",
  "attribute_values.definition.template.groups",
  // A gift card the shop sells (adr/0025 Ek 2026-11-03)
  "product_extension.is_gift_card",
  // Its withdrawal mark, read by its kind (adr/0052 Ek 2026-11-03): on the product's own answer only
  "product_extension.withdrawal_excluded",
  "product_extension.kind",
]

export interface ProductQuery {
  ids?: readonly string[]
  /** Medusa's keyword search over titles and descriptions (until Meilisearch, D10). */
  q?: string
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
    q: query.q,
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
  const { product_categories } = await storePublicGet<{ product_categories: StoreCategory[] }>(
    "/store/product-categories",
    { fields: "id,name,handle,description,parent_category_id,rank", limit: 100 }
  )
  return product_categories
})

/**
 * The 30-day rule's prices by variant (F4.3), a hundred at a time: the one
 * way every page, card, quick view and suggestion is priced. A signed-in
 * wholesaler's are their own instead (ADR-0068 §7, without KDV), from the
 * personal route; everyone else's the public display.
 */
export async function priceDisplays(
  variantIds: readonly string[]
): Promise<Record<string, PriceDisplay>> {
  const unique = [...new Set(variantIds)]
  if (unique.length > 0 && (await currentWholesale()).active) {
    return wholesaleDisplays(unique)
  }
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

// A brands page reads them all; past this many, a shop needs a search of its own (D10)
const MAX_BRANDS = 1000
const BRANDS_PAGE = 100

/** Every active brand, by name (F3.11), a hundred at a time: `/markalar`. */
export const allBrands = cache(async (): Promise<StoreBrandSummary[]> => {
  const brands: StoreBrandSummary[] = []
  for (let offset = 0; offset < MAX_BRANDS; offset += BRANDS_PAGE) {
    const page = await storePublicGet<{ brands: StoreBrandSummary[]; count: number }>(
      "/store/brands",
      { limit: BRANDS_PAGE, offset }
    )
    brands.push(...page.brands)
    if (page.brands.length < BRANDS_PAGE || offset + BRANDS_PAGE >= page.count) {
      break
    }
  }
  return brands
})

/** A brand with its text: plain, and as the shop formatted it (adr/0075; absent from a backend before it). */
export const brandById = cache((id: string) =>
  storeGet<{
    brand: {
      id: string
      name: string
      handle: string
      description: string | null
      description_html?: string | null
    }
  }>(`/store/brands/${encodeURIComponent(id)}`)
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

/** With each review's photos and the stars' spread (adr/0046 Ek 2026-11-04). */
export type ReviewsAnswer = StoreProductReviews

/**
 * As many as the backend gives at once (50), so the page can filter and
 * sort them all and show more without asking again (owner 2026-11-06).
 */
const COMMUNITY_PAGE = 50

export const productReviews = (id: string) =>
  storeGet<ReviewsAnswer>(`/store/products/${encodeURIComponent(id)}/reviews`, {
    limit: COMMUNITY_PAGE,
  })

export interface QuestionsAnswer {
  questions: {
    body: string
    author_name: string | null
    created_at: string
    answers: { body: string; author_name: string | null; by_shop: boolean }[]
  }[]
  count: number
}

export const productQuestions = (id: string) =>
  storeGet<QuestionsAnswer>(`/store/products/${encodeURIComponent(id)}/questions`, {
    limit: COMMUNITY_PAGE,
  })
