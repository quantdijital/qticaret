import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { CARD_PROVIDER_IDS, connectedCardProviders } from "../../../../lib/payments/card-providers"

/**
 * GET /store/payment/methods (F5 V10): the card providers a storefront can
 * start a payment with (`POST /store/carts/:id/payment-session`), the
 * shop's choice first. Only providers with a stored account; Medusa's own
 * list names every provider the region has, connected or not.
 */
export const GET = async (req: MedusaStoreRequest, res: MedusaResponse) => {
  const providers = await connectedCardProviders(req.scope)
  res.json({ card_providers: providers.map((provider) => CARD_PROVIDER_IDS[provider]) })
}
