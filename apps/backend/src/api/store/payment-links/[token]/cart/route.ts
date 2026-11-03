import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { openPaymentLinkCartWorkflow } from "../../../../../workflows/payment-links/open-cart"
import { storeLink } from "../../../../../workflows/payment-links/store-link"
import { privatePage } from "../../private-page"
import type { StorePostPaymentLinkCartType } from "./validators"

/**
 * POST /store/payment-links/:token/cart (adr/0051 §3): "Ödemeye geç". A
 * fresh cart from the link at its prices, with its discount; the
 * storefront keeps its id as its cart and goes on to `/odeme`. Each press
 * opens a new cart and the link's earlier one no longer completes. A link
 * whose prices moved answers 409 (`payment_link.prices_changed`) and staff
 * are told; one with a line short, 409 (`payment_link.out_of_stock`).
 */
export async function POST(
  req: MedusaStoreRequest<StorePostPaymentLinkCartType>,
  res: MedusaResponse
): Promise<void> {
  privatePage(res)
  const link = await storeLink(req.scope, req.params["token"] ?? "")
  const channel = req.publishable_key_context.sales_channel_ids[0]
  if (!channel) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "payment_link.unavailable")
  }
  const { result } = await openPaymentLinkCartWorkflow(req.scope).run({
    input: { link_id: link.id, sales_channel_id: channel },
  })
  res.json({ cart_id: result.cart_id })
}
