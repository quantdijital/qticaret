import type { MedusaContainer } from "@medusajs/framework/types"
import { fromMedusaAmount } from "../../lib/money"
import { discountView } from "../../lib/pricing"
import type { DiscountView } from "../../lib/pricing"
import { PRICE_HISTORY_MODULE } from "../../modules/price-history"
import type PriceHistoryModuleService from "../../modules/price-history/service"

const kurus = (amount: number | string) => fromMedusaAmount(amount, { allowRounding: true })

// The whole history: a discount may have begun long ago, and rows are written only on a change
const BEGINNING = new Date(0)

/** A variant's discount in a currency as the 30-day rule shows it (F4.3, ADR-0023). */
export async function discountViewOf(
  container: MedusaContainer,
  variantId: string,
  currencyCode: string
): Promise<DiscountView | null> {
  const rows = await container
    .resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE)
    .pricesSince(variantId, currencyCode, BEGINNING)
  return discountView(
    rows.map((row) => ({
      at: new Date(row.recorded_at),
      amount: kurus(row.amount),
      original: kurus(row.original_amount),
    }))
  )
}
