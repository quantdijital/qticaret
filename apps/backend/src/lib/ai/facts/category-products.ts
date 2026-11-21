import { LISTING_BRAND_FIELDS, listingProductFacts } from "./listing-products"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * What a category page lists (adr/0074 §4): a few of its published
 * products' names, its most frequent brands and how many products it has,
 * as a range; read the way every listing page is (facts/listing-products.ts).
 */

export {
  LISTING_CHANNEL_FIELD as CATEGORY_CHANNEL_FIELD,
  LISTING_PRODUCT_EXAMPLES as CATEGORY_PRODUCT_EXAMPLES,
  LISTING_PRODUCT_FIELDS as CATEGORY_PRODUCT_FIELDS,
  LISTING_SAMPLE as CATEGORY_BRAND_SAMPLE,
  LISTING_TOP_NAMES as CATEGORY_TOP_BRANDS,
  productCountLabel,
} from "./listing-products"

export const CATEGORY_BRAND_FIELDS = LISTING_BRAND_FIELDS

/** The category's listing as the data block takes it; empty fields for a category with none. */
export const categoryProductFacts = (
  container: FactsContainer,
  categoryId: string
): Promise<RecordFacts> =>
  listingProductFacts(container, { categories: { id: [categoryId] } }, "brands")
