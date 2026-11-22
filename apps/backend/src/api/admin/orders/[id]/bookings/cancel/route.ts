import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../../lib/money"
import { cancelBookingDeparture } from "../../../../../../workflows/booking/cancel"
import type { AdminPostOrderBookingCancelType } from "../validators"

/**
 * POST /admin/orders/:id/bookings/cancel (adr/0076 Ek D7a): staff cancel
 * one departure of an order, by its tier or with everything back; the
 * server works the refund out; money taken by hand or with credit is
 * left to staff (`refund_by_hand`, the bell rings). Owner and admin (money goes back: the
 * role table's default for a POST not given to operations).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderBookingCancelType>,
  res: MedusaResponse
): Promise<void> {
  const result = await cancelBookingDeparture(req.scope, {
    order_id: req.params["id"] ?? "",
    slot_id: req.validatedBody.slot_id,
    mode: req.validatedBody.mode,
    by: "staff",
    created_by: req.auth_context.actor_id,
  })
  res.json({
    order_id: result.order_id,
    slot_id: result.slot_id,
    cancelled: result.cancelled,
    refunded: toMedusaAmount(result.refunded),
    // Money not sent on its own (a bank transfer, cash, credit used): staff give it back by hand
    refund_by_hand: toMedusaAmount(result.refund_by_hand),
    manual: result.manual,
    order_cancelled: result.order_cancelled,
  })
}
