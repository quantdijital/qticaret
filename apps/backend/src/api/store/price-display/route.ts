import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../lib/money"
import { priceDisplays } from "../../../workflows/pricing/price-display"
import type { StoreGetPriceDisplayType } from "./validators"

/**
 * `GET /store/price-display` (F4.3, ADR-0023): how each variant's price is
 * shown: the price now and, only when the 30-day rule lets it be shown as
 * a discount, the price before it, struck through. The same reading feeds
 * the product page's structured data. Amounts are lira ("80.00").
 */
export async function GET(
  req: MedusaRequest<unknown, StoreGetPriceDisplayType>,
  res: MedusaResponse
): Promise<void> {
  const { variant_id: ids, currency_code: currency } =
    req.validatedQuery as StoreGetPriceDisplayType
  const displays = await priceDisplays(req.scope, ids, currency)
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
        },
      ])
    ),
  })
}
