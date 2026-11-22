import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { departureCancelViews } from "../../../../../workflows/booking/cancel-view"
import type { AdminGetOrderBookingsType } from "./validators"

/**
 * GET /admin/orders/:id/bookings (adr/0076 Ek D7a): the order's
 * departures, each with what cancelling it would give back by `mode`
 * (the tier, or all of it); read only, every role that reads orders.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetOrderBookingsType>,
  res: MedusaResponse
): Promise<void> {
  const query = req.validatedQuery as AdminGetOrderBookingsType
  res.json(
    await departureCancelViews(req.scope, {
      order_id: req.params["id"] ?? "",
      by: "staff",
      mode: query.mode,
    })
  )
}
