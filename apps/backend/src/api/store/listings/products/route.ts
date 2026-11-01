import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { readListingQuery } from "../../../../lib/seo/facets"
import { listingFilterKeys } from "../../../../workflows/seo/listing"
import { listingProducts } from "../../../../workflows/seo/listing-products"
import type { StoreGetListingProductsType } from "../validators"

/**
 * `GET /store/listings/products` (F18 D4): one page of a listing's
 * products as ids, filtered, priced and sorted for the shopper's region,
 * with the filters it can offer and their counts. The storefront loads
 * the products by id (`/store/products?id[]=`), as it does a brand's.
 * A query a listing does not answer (more filters than allowed) is 404,
 * as its page is.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetListingProductsType>,
  res: MedusaResponse
): Promise<void> {
  const { type, id, region_id, currency_code, query } = req.validatedQuery
  const read = readListingQuery(new URLSearchParams(query), await listingFilterKeys(req.scope))
  if (read.kind === "out_of_bounds") {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "listing.out_of_bounds")
  }
  res.json(
    await listingProducts(req.scope, {
      listed: { entity_type: type, entity_id: id },
      query: read.query,
      region_id,
      currency_code,
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
    })
  )
}
