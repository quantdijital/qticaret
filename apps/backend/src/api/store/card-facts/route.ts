import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { cardFacts } from "../../../workflows/storefront/card-facts"
import type { DepartureDates } from "../../../modules/booking/service"
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
 * channels answer. Stock changes by the minute: not kept by caches. A
 * date search's page (adr/0077 §4) sends its dates (`from`/`to` or
 * `months`) and `pax`: a dated card then says the nearest departure
 * inside them with room for the party, its places left and the from
 * price over them (`in_range`). Without them the answer is as before.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetCardFactsType>,
  res: MedusaResponse
): Promise<void> {
  const { id, region_id, from, to, months, pax } = req.validatedQuery
  const dates: DepartureDates | null =
    from !== undefined && to !== undefined
      ? { ranges: [{ from, to }] }
      : months !== undefined
        ? { months: months.split(",") }
        : null
  const facts = await cardFacts(req.scope, {
    product_ids: id,
    sales_channel_ids: req.publishable_key_context.sales_channel_ids,
    region_id,
    // The party alone narrows nothing on a card: the dates make it a search's
    window: dates ? { dates, pax: pax ?? 1 } : undefined,
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({ facts })
}
