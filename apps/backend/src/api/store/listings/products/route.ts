import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { normalizeText } from "../../../../lib/search"
import { readListingQuery } from "../../../../lib/seo/facets"
import { listingFilterKeys } from "../../../../workflows/seo/listing"
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
 * first unfiltered page is counted for the search report (F11.8).
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetListingProductsType>,
  res: MedusaResponse
): Promise<void> {
  const { type, id, q, region_id, currency_code, query } = req.validatedQuery
  const read = readListingQuery(new URLSearchParams(query), await listingFilterKeys(req.scope))
  if (read.kind === "out_of_bounds") {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "listing.out_of_bounds")
  }
  const isSearch = type === SEARCH_LISTING
  const answer = await listingProducts(req.scope, {
    listed: { entity_type: type, entity_id: isSearch ? normalizeText(q ?? "") : (id ?? "") },
    ...(isSearch ? { search: q ?? "" } : {}),
    query: read.query,
    region_id,
    currency_code,
    sales_channel_ids: req.publishable_key_context.sales_channel_ids,
  })
  res.json(answer)
  // A next page, or the same search narrowed, is not another search
  const { page, filters, price } = read.query
  if (isSearch && page === 1 && filters.length === 0 && price === null) {
    countSearchTerm(req, q, answer.count)
  }
}
