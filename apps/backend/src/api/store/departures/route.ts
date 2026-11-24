import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { DEPARTURES_LIMITS } from "../../../lib/storefront/sections/departures"
import { upcomingDepartures } from "../../../workflows/booking/upcoming"
import type { UpcomingScope } from "../../../workflows/booking/upcoming"
import type { StoreGetDeparturesType } from "./validators"

/**
 * GET /store/departures?limit=[&category_id=|kategori=|collection_id=]
 * (adr/0077 §10), behind `catalog.booking`: the nearest departures a
 * shopper could book now, by date, at most two a product, each with its
 * product, places left when few and its lowest paying price in lira (the
 * card's unit). Only published products in the shopper's sales channels.
 * Prices are worked out here; nothing priced is read from the request.
 * Kept 30 seconds on the server, so a shopper's cache keeps it no longer.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetDeparturesType>,
  res: MedusaResponse
): Promise<void> {
  const { limit, category_id, kategori, collection_id } = req.validatedQuery
  const scope: UpcomingScope = category_id
    ? { kind: "category", id: category_id }
    : kategori
      ? { kind: "category_handle", handle: kategori }
      : collection_id
        ? { kind: "collection", id: collection_id }
        : { kind: "all" }
  const answer = await upcomingDepartures(req.scope, {
    limit: limit ?? DEPARTURES_LIMITS.limit.default,
    scope,
    sales_channel_ids: req.publishable_key_context.sales_channel_ids,
  })
  res.setHeader("Cache-Control", "no-store")
  res.json(answer)
}
