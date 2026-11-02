import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { cartGiftLines } from "../../../../../workflows/gift-cards/cart-gifts"

/**
 * GET /store/carts/:id/gift-lines (adr/0025 Ek 2026-11-03): the cart's gift
 * card lines and the recipient each names (null: not yet; the payment
 * waits for it). Only a cart of this storefront's.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const lines = await cartGiftLines(
    req.scope,
    req.params["id"] ?? "",
    req.publishable_key_context.sales_channel_ids
  )
  res.setHeader("Cache-Control", "no-store")
  res.json({ gift_lines: lines })
}
