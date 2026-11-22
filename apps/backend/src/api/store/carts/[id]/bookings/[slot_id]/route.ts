import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { removeCartBookingWorkflow } from "../../../../../../workflows/booking/cart/remove-booking"
import { bookingCartView } from "../../../../../../workflows/booking/cart/views"

/**
 * DELETE /store/carts/:id/bookings/:slot_id (adr/0076 §5): the departure
 * leaves the cart, its places given back. Behind `catalog.booking`.
 */
export async function DELETE(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const { result } = await removeCartBookingWorkflow(req.scope).run({
    input: {
      cart_id: cartId,
      slot_id: req.params["slot_id"] ?? "",
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
    },
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({
    booking: { slot_id: result.slot_id, removed: result.removed },
    ...(await bookingCartView(req.scope, cartId, req.publishable_key_context.sales_channel_ids)),
  })
}
