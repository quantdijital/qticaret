import type { MedusaContainer } from "@medusajs/framework/types"
import { shownByProduct } from "../../lib/pricing"
import type { ProductShown } from "../../lib/pricing"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import type { ListingPlan } from "../../modules/search-index/types"
import { CURRENCY } from "../catalog/prices"
import { priceDisplays } from "./price-display"

/** The sale listing's type and id (`/kampanyalar`; `GET /store/listings/products?type=sale&id=sale`). */
export const SALE_LISTING = "sale"

/** The sale listing in the search index: the rows marked on sale when they were indexed. */
export const SALE_SCOPE: ListingPlan["scope"] = { on_sale: true }

/** A product and its variants, as the indexing workflow reads them. */
export interface ProductVariants {
  id: string
  variant_ids: readonly string[]
}

/**
 * How these products' prices are shown now in the shop's currency, exactly
 * as the storefront's price is (`priceDisplays`: a sale price list, or an
 * automatic promotion every shopper gets, struck through only by the
 * price-before rule; adr/0019 ek 2026-11-03, adr/0023 Ek 2026-11-05):
 * whether each is on sale, and its lowest price. Worked out when a product
 * is indexed (search-index `on_sale`, `prices`), so the sale listing is one
 * statement however much of the catalogue a promotion covers, no request
 * scans it, and listings filter and sort by the price the cards show.
 */
export async function productsShown(
  container: MedusaContainer,
  products: readonly ProductVariants[]
): Promise<Map<string, ProductShown>> {
  const variants = products.flatMap((product) =>
    product.variant_ids.map((id) => ({ id, product_id: product.id }))
  )
  if (variants.length === 0) {
    return new Map()
  }
  const displays = await priceDisplays(
    container,
    variants.map((variant) => variant.id),
    CURRENCY
  )
  return shownByProduct(variants, displays)
}

// The sale listing read from the index, in these sales channels (null: any), newest first
const salePlan = (
  limit: number,
  countOnly: boolean,
  channels: string[] | null = null
): ListingPlan => ({
  channels,
  scope: SALE_SCOPE,
  text: null,
  filters: { brands: null, options: [], in_stock: false },
  price: { key: "", min: null, max: null },
  sort: "newest",
  page: { offset: 0, limit },
  countOnly,
})

const indexOf = (container: MedusaContainer) =>
  container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)

/**
 * The newest published products on sale now, at most `limit`: the sale
 * page's structured data, and a home sale rail's (only those in the
 * shopper's sales channels).
 */
export async function saleProductIds(
  container: MedusaContainer,
  limit: number,
  channels: readonly string[] | null = null
): Promise<string[]> {
  return (await indexOf(container).listing(salePlan(limit, false, channels && [...channels]))).ids
}

/** Whether a published product is on sale now: the sale page is indexed and in the sitemap. */
export async function isAnythingOnSale(container: MedusaContainer): Promise<boolean> {
  return (await indexOf(container).listing(salePlan(1, true))).count > 0
}
