import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { normalizeText } from "../../../../lib/search"
import { listingSearch, readListingQuery } from "../../../../lib/seo/facets"
import { listingFilterKeys, listingReadOptions } from "../../../../workflows/seo/listing"
import { listingProducts } from "../../../../workflows/seo/listing-products"
import { SEARCH_LISTING } from "../../../../workflows/seo/listing-search"
import { countSearchTerm } from "../../../http/search-terms"
import type { StoreGetListingProductsType } from "../validators"

/**
 * `GET /store/listings/products` (F18 D4): one page of a listing's
 * products as ids, filtered, priced and sorted for the shopper's region,
 * with the filters it can offer and their counts. The storefront loads
 * the products by id (`/store/products?id[]=`), as it does a brand's.
 * A query a listing does not answer (more filters than allowed) is 404,
 * as its page is. A site search (`type=search`, `q`) answers the same,
 * most relevant first, with `search` (suggestions, related chips); its
 * first unfiltered page is counted for the search report (F11.8). A
 * search without `q` answers when its query asks dates or a category
 * (adr/0077 §2; dates only while the shop sells dated products), else it
 * is refused as an empty search. A query not in canonical form comes back
 * with `canonical_query`, where its page moves.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetListingProductsType>,
  res: MedusaResponse
): Promise<void> {
  const { type, id, q, region_id, currency_code, query } = req.validatedQuery
  const isSearch = type === SEARCH_LISTING
  const [keys, options] = await Promise.all([
    listingFilterKeys(req.scope),
    listingReadOptions(req.scope, isSearch),
  ])
  const read = readListingQuery(new URLSearchParams(query), keys, options)
  if (read.kind === "out_of_bounds") {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "listing.out_of_bounds")
  }
  if (isSearch && q === undefined && !read.query.dates && !read.query.category) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "listing.search_query_invalid")
  }
  const answer = await listingProducts(req.scope, {
    listed: { entity_type: type, entity_id: isSearch ? normalizeText(q ?? "") : (id ?? "") },
    ...(isSearch && q !== undefined ? { search: q } : {}),
    query: read.query,
    region_id,
    currency_code,
    sales_channel_ids: req.publishable_key_context.sales_channel_ids,
  })
  res.json(read.isCanonical ? answer : { ...answer, canonical_query: listingSearch(read.query) })
  // A next page, or the same search narrowed, is not another search
  const { page, filters, price } = read.query
  if (isSearch && q !== undefined && page === 1 && filters.length === 0 && price === null) {
    countSearchTerm(req, q, answer.count)
  }
}
