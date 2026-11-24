import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { bookingFlow, byContact, cancelContactOf } from "../../../../../lib/booking/flow"
import { departureCancelViews } from "../../../../../workflows/booking/cancel-view"
import { orderAccessOf } from "../../../../http/order-access"

/**
 * GET /store/orders/:id/bookings (adr/0076 Ek D7a): the order's
 * departures for its own shopper (signed in, or with the order's key),
 * each with whether it can be cancelled now and what would come back by
 * its tier, worked out on the server. Nothing is changed; no personal data.
 * While the shop takes cancels by phone or e-mail (Ek basit yol), none is
 * cancellable and `contact` says how to reach the shop. `voucher`: whether
 * the shop gives vouchers (Ek D7b), so the order page may link to its own.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const access = orderAccessOf(req)
  const view = await departureCancelViews(req.scope, {
    order_id: access.order_id,
    by: "customer",
    mode: "tier",
  })
  const flow = await bookingFlow(req.scope)
  res.setHeader("Cache-Control", "no-store")
  const shown = flow.online_cancel_enabled
    ? view
    : byContact(view, await cancelContactOf(req.scope, flow))
  res.json({ ...shown, voucher: flow.voucher_enabled })
}
