import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import { DISCOUNT_RULE } from "../../../../../lib/pricing"
import type { PriceDisplay } from "../../../../../lib/pricing"
import { productPriceHistory } from "../../../../../workflows/pricing/product-price-history"
import type { AdminGetPriceHistoryType } from "./validators"

const amountOf = (value: PriceDisplay["current"] | null) =>
  value === null ? null : toMedusaAmount(value)

/**
 * `GET /admin/products/:id/price-history` (F4.3): each variant's selling
 * price over the last 90 days and how it is shown today, with the 30-day
 * rule's price before a discount even when it keeps the discount from
 * being struck through. Amounts are lira ("80.00").
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetPriceHistoryType>,
  res: MedusaResponse
): Promise<void> {
  const { currency_code: currency } = req.validatedQuery as AdminGetPriceHistoryType
  const history = await productPriceHistory(req.scope, req.params["id"] ?? "", currency)
  res.json({
    currency_code: currency,
    rule_version: DISCOUNT_RULE.version,
    window_days: DISCOUNT_RULE.windowDays,
    window_start: history.window_start,
    variants: history.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      display: variant.display && {
        current: toMedusaAmount(variant.display.current),
        regular: toMedusaAmount(variant.display.regular),
        before: amountOf(variant.display.before),
        lowest_before: amountOf(variant.display.lowest_before),
        on_sale: variant.display.on_sale,
        since: variant.display.since,
        basis: variant.display.basis,
      },
      points: variant.points.map((point) => ({
        at: point.at,
        amount: toMedusaAmount(point.amount),
        original: toMedusaAmount(point.original),
      })),
    })),
  })
}
