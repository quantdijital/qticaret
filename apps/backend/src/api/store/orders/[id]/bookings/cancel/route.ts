import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../../lib/money"
import { cancelBookingDeparture } from "../../../../../../workflows/booking/cancel"
import { orderAccessOf } from "../../../../../http/order-access"
import type { StorePostBookingCancelType } from "../validators"

/**
 * POST /store/orders/:id/bookings/cancel (adr/0076 §8, Ek D7a): the
 * shopper cancels one departure of their order; its tier decides what
 * comes back, worked out on the server, refunded to the card it was paid
 * with. Asked again: the same answer, nothing more given back.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const access = orderAccessOf(req)
  const body = req.validatedBody as StorePostBookingCancelType
  const result = await cancelBookingDeparture(req.scope, {
    order_id: access.order_id,
    slot_id: body.slot_id,
    mode: "tier",
    by: "customer",
    customer_id: access.customer_id ?? "",
  })
  res.json({
    order_id: result.order_id,
    slot_id: result.slot_id,
    cancelled: result.cancelled,
    refunded: toMedusaAmount(result.refunded),
  })
}
