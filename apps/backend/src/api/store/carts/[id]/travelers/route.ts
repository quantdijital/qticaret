import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import {
  cartTravelersView,
  setCartTravelers,
} from "../../../../../workflows/booking/cart/travelers"
import type { StorePostCartTravelersType } from "./validators"

/**
 * GET /store/carts/:id/travelers (adr/0076 §7): what the cart's
 * departures ask (`needs`: level and count, worked out on the server), the
 * travelers entered, an ID or passport number only as its last four
 * (`document_masked`), and whether they answer it (`complete`). Only this
 * storefront's cart. Behind `catalog.booking`.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json(
    await cartTravelersView(
      req.scope,
      req.params["id"] ?? "",
      req.publishable_key_context.sales_channel_ids
    )
  )
}

/**
 * POST /store/carts/:id/travelers: the cart's travelers replaced by these;
 * answered as GET reads them (the number masked, never sent back).
 */
export async function POST(
  req: MedusaStoreRequest<StorePostCartTravelersType>,
  res: MedusaResponse
): Promise<void> {
  const cartId = req.params["id"] ?? ""
  const channels = req.publishable_key_context.sales_channel_ids
  await setCartTravelers(req.scope, cartId, channels, req.validatedBody.travelers)
  res.setHeader("Cache-Control", "no-store")
  res.json(await cartTravelersView(req.scope, cartId, channels))
}
