import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { cardFacts } from "../../../workflows/storefront/card-facts"
import type { StoreGetCardFactsType } from "./validators"

/**
 * GET /store/card-facts?id= (adr/0046 Ek 2026-11-04): what a product card
 * says beside its price, for one page of cards (a listing, a search, a
 * home rail): `stock` as a bucket (`in_stock`, `low`, `out`; never the
 * number), `quick_add` (the one variant a card may put in the cart, or
 * null) and `rating` (the average and count of its approved reviews, or
 * null; adr/0062); while the shop sells dated products, a dated one's
 * `booking` (from price in `region_id`'s currency, next departure;
 * adr/0076 §10). Only published products in the shopper's sales
 * channels answer. Stock changes by the minute: not kept by caches.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetCardFactsType>,
  res: MedusaResponse
): Promise<void> {
  const facts = await cardFacts(req.scope, {
    product_ids: req.validatedQuery.id,
    sales_channel_ids: req.publishable_key_context.sales_channel_ids,
    region_id: req.validatedQuery.region_id,
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({ facts })
}
