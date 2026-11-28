import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import { estimateCartShipping } from "../../../../../workflows/shipping/cart-estimate"

/**
 * GET /store/carts/:id/shipping-estimate: the cart's shipping before an
 * address, for the cart page and the header's drawer. The shop's main
 * option priced on the server by the quote checkout charges (adr/0087 §2):
 * `free`, `priced` with `amount` (lira, KDV in), `at_checkout` when only
 * the destination or a carrier's quote can say, `not_needed` when nothing
 * travels. Nothing is taken from the request but the cart, whose id is the
 * shopper's own credential; a cart unknown or already an order is 404.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const estimate = await estimateCartShipping(req.scope, req.params["id"] ?? "")
  res.setHeader("Cache-Control", "no-store")
  res.json({
    shipping_estimate: {
      status: estimate.status,
      amount: estimate.status === "priced" ? Number(toMedusaAmount(estimate.amount)) : null,
    },
  })
}
