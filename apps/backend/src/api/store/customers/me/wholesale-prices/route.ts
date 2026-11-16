import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import { wholesalePrices } from "../../../../../workflows/wholesale/shopper"
import type { StoreGetWholesalePricesType } from "./validators"

/**
 * `GET /store/customers/me/wholesale-prices?variant_id=` (ADR-0068 §7):
 * what the signed-in wholesaler pays for each variant, without KDV
 * (`net`) and with it (`gross`), lira ("80.00"), and the KDV rate in
 * percent. The customer is the session's; the price is Medusa's for
 * their groups, as their cart prices it. Anyone else gets `{}`. Personal:
 * kept by nobody on the way.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, StoreGetWholesalePricesType>,
  res: MedusaResponse
): Promise<void> {
  const prices = await wholesalePrices(req.scope, {
    customer_id: req.auth_context.actor_id,
    variant_ids: req.validatedQuery.variant_id,
    // Medusa's own key check stands before every Store route; no key, no variant seen
    sales_channel_ids: req.publishable_key_context?.sales_channel_ids ?? [],
  })
  res.setHeader("Cache-Control", "private, no-store")
  res.json({
    wholesale_prices: Object.fromEntries(
      [...prices].map(([id, price]) => [
        id,
        {
          net: toMedusaAmount(price.net),
          gross: toMedusaAmount(price.gross),
          vat_rate: price.vat_bps / 100,
        },
      ])
    ),
  })
}
