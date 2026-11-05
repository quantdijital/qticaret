import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { normalizeText } from "../../../../lib/search"
import type { ListingQuery } from "../../../../lib/seo/facets"
import { listingProducts } from "../../../../workflows/seo/listing-products"
import { SEARCH_LISTING } from "../../../../workflows/seo/listing-search"
import type { RelatedTerms } from "../../../../workflows/seo/listing-search"
import type { StoreGetListingSuggestType } from "../validators"

/** The products a live search shows under the field. */
export const SUGGESTED_PRODUCTS = 6

// The search's own order (relevance), its first page, nothing narrowed
const FIRST_PAGE: ListingQuery = { filters: [], price: null, sort: null, page: 1, rest: [] }

export interface ListingSuggestAnswer {
  /** The most relevant few, as ids; the storefront loads and prices them. */
  product_ids: string[]
  /** How many the search finds in all (its `/arama` page's count). */
  count: number
  /** "Did you mean": the catalogue's spelling of a word it does not hold. */
  suggestions: string[]
  /** The categories and brands most hits are in. */
  related: RelatedTerms
}

/**
 * `GET /store/listings/suggest` (live search, 2026-11-05): the site search
 * the listing route answers (`type=search`, adr/0056: full text, typos,
 * synonyms) read as the shopper types, its first few products as ids, how
 * many it finds, its suggestions and related categories and brands. Never
 * counted for the search report (F11.8): half-typed words are no search;
 * the page `/arama` asks for is.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetListingSuggestType>,
  res: MedusaResponse
): Promise<void> {
  const { q, region_id, currency_code } = req.validatedQuery
  const answer = await listingProducts(req.scope, {
    listed: { entity_type: SEARCH_LISTING, entity_id: normalizeText(q) },
    search: q,
    query: FIRST_PAGE,
    region_id,
    currency_code,
    sales_channel_ids: req.publishable_key_context.sales_channel_ids,
    limit: SUGGESTED_PRODUCTS,
  })
  const body: ListingSuggestAnswer = {
    product_ids: answer.product_ids,
    count: answer.count,
    suggestions: answer.search?.suggestions ?? [],
    related: answer.search?.related ?? { categories: [], brands: [] },
  }
  res.json(body)
}
