import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { storeProductBooking } from "../../../../../workflows/booking/store-view"
import type { StoreGetProductBookingType } from "./validators"

/**
 * GET /store/products/:id/booking (adr/0076 §10): a dated product's
 * departures, places free and prices for its page; behind `catalog.booking`.
 * Places change by the minute: a short shared cache only.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const query = req.validatedQuery as StoreGetProductBookingType
  const booking = await storeProductBooking(
    req.scope,
    req.params["id"] ?? "",
    req.publishable_key_context.sales_channel_ids,
    query.region_id
  )
  res.setHeader("Cache-Control", "public, max-age=15")
  res.json({ booking })
}
