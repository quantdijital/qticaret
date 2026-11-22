import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { departureCancelViews } from "../../../../../workflows/booking/cancel-view"
import { orderAccessOf } from "../../../../http/order-access"

/**
 * GET /store/orders/:id/bookings (adr/0076 Ek D7a): the order's
 * departures for its own shopper (signed in, or with the order's key),
 * each with whether it can be cancelled now and what would come back by
 * its tier, worked out on the server. Nothing is changed; no personal data.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const access = orderAccessOf(req)
  const view = await departureCancelViews(req.scope, {
    order_id: access.order_id,
    by: "customer",
    mode: "tier",
  })
  res.setHeader("Cache-Control", "no-store")
  res.json(view)
}
