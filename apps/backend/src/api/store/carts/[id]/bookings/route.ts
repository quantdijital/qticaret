import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { bookingClientHash } from "../../../../http/booking-store-routes"
import { setCartBookingWorkflow } from "../../../../../workflows/booking/cart/set-booking"
import { bookingCartView } from "../../../../../workflows/booking/cart/views"
import type { StorePostCartBookingType } from "./validators"

/**
 * GET /store/carts/:id/bookings (adr/0076 Ek D5): the cart's hold (its end,
 * for the storefront's countdown) and its dated lines, each saying whether
 * the live hold still keeps its places; `shipping_method_stale` as the
 * booking answers give it. The cart's id is its key, as for Medusa's own
 * cart route; no person's data. Behind `catalog.booking`.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json(
    await bookingCartView(
      req.scope,
      req.params["id"] ?? "",
      req.publishable_key_context.sales_channel_ids
    )
  )
}

/**
 * POST /store/carts/:id/bookings (adr/0076 §5): a departure's places held
 * for the cart and its lines priced on the server; sent again for the same
 * departure, its lines become these. Behind `catalog.booking`.
 */
export async function POST(
  req: MedusaStoreRequest<StorePostCartBookingType>,
  res: MedusaResponse
): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const { result } = await setCartBookingWorkflow(req.scope).run({
    input: {
      cart_id: cartId,
      slot_id: req.validatedBody.slot_id,
      items: req.validatedBody.items,
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
      client_hash: bookingClientHash(req),
    },
  })
  res.setHeader("Cache-Control", "no-store")
  res.json({
    booking: { slot_id: result.slot_id, units: result.units },
    ...(await bookingCartView(req.scope, cartId, req.publishable_key_context.sales_channel_ids)),
  })
}
