import type { MedusaContainer } from "@medusajs/framework/types"
import { chunksOf } from "../../lib/catalog"
import { fromMedusaAmount } from "../../lib/money"
import { priceDisplay } from "../../lib/pricing"
import type { PriceDisplay } from "../../lib/pricing"
import { PRICE_HISTORY_MODULE } from "../../modules/price-history"
import type PriceHistoryModuleService from "../../modules/price-history/service"
import { sellingPrices } from "./selling-prices"

// Variants priced per query
const VARIANT_CHUNK = 100

const kurus = (amount: number | string) => fromMedusaAmount(amount, { allowRounding: true })

/**
 * How each variant's price is shown in a currency (F4.3, ADR-0023): its
 * selling price now beside its recorded history. One source for the
 * storefront's price and the page's structured data. A variant with no
 * price in the currency has no display.
 */
export async function priceDisplays(
  container: MedusaContainer,
  variantIds: readonly string[],
  currency: string,
  now: Date = new Date()
): Promise<Map<string, PriceDisplay>> {
  const ids = [...new Set(variantIds)]
  const history = await container
    .resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE)
    .historyOf(ids, currency)
  const displays = new Map<string, PriceDisplay>()
  for (const chunk of chunksOf(ids, VARIANT_CHUNK)) {
    for (const variant of await sellingPrices(container, chunk, currency)) {
      const amount = variant.calculated_price?.calculated_amount
      if (amount === null || amount === undefined) {
        continue
      }
      const points = (history.get(variant.id) ?? []).map((row) => ({
        at: new Date(row.recorded_at),
        amount: kurus(row.amount),
        original: kurus(row.original_amount),
      }))
      const live = {
        amount: kurus(amount),
        original: kurus(variant.calculated_price?.original_amount ?? amount),
      }
      displays.set(variant.id, priceDisplay(points, live, now))
    }
  }
  return displays
}
