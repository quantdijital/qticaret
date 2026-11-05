import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../lib/money"
import type { CartOffer } from "../../../lib/pricing/offers"
import { priceDisplays } from "../../../workflows/pricing/price-display"
import { shopperVariantIds } from "../../../workflows/pricing/selling-prices"
import type { StoreGetPriceDisplayType } from "./validators"

const offerValue = (offer: CartOffer) =>
  offer.method.type === "percentage" ? offer.method.value : toMedusaAmount(offer.method.value)

/**
 * `GET /store/price-display` (F4.3, ADR-0023): how each variant's price is
 * shown: the price now (an automatic promotion every shopper gets on it
 * included, adr/0023 Ek 2026-11-05) and, only when the price-before rule
 * lets it be shown as a discount, the price before it, struck through;
 * and an automatic promotion the cart applies past a minimum, to name
 * beside the price (`cart_offer`). The same reading feeds the product
 * page's structured data. Amounts are lira ("80.00"). Only variants of
 * published products in the key's sales channels answer.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetPriceDisplayType>,
  res: MedusaResponse
): Promise<void> {
  const { variant_id: ids, currency_code: currency } =
    req.validatedQuery as StoreGetPriceDisplayType
  const visible = await shopperVariantIds(
    req.scope,
    ids,
    req.publishable_key_context.sales_channel_ids
  )
  const displays = await priceDisplays(req.scope, visible, currency)
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({
    price_display: Object.fromEntries(
      [...displays].map(([id, display]) => [
        id,
        {
          current: toMedusaAmount(display.current),
          regular: toMedusaAmount(display.regular),
          before: display.before === null ? null : toMedusaAmount(display.before),
          on_sale: display.on_sale,
          since: display.since,
          basis: display.basis,
          rule_version: display.rule_version,
          cart_offer: display.cart_offer && {
            type: display.cart_offer.method.type,
            // A percentage as a number (30), an amount as lira ("50.00")
            value: offerValue(display.cart_offer),
            minimum:
              display.cart_offer.minimum === null
                ? null
                : toMedusaAmount(display.cart_offer.minimum),
          },
        },
      ])
    ),
  })
}
