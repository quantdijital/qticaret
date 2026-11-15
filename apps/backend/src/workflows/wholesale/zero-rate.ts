import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { rateGivesNothing } from "../../lib/wholesale"
import { variantsBySet } from "../pricing/price-list-lines"
import { PRICE_ROW_FIELDS, isPlainPrice, kurusOfRow } from "../pricing/price-rows"
import type { PriceRow } from "../pricing/price-rows"

// The lines screen names a few; the count says how many
const NAMED = 20

export interface ZeroRate {
  count: number
  variant_ids: string[]
}

/**
 * The variants a level's rate would sell at 0,00 (ADR-0068 §4): their own
 * price is a few kuruş, so the rate leaves nothing. They get no row and
 * keep their retail price; the panel names them so a price can be
 * entered by hand.
 */
export async function zeroRateVariants(
  container: MedusaContainer,
  currency: string,
  rateBps: number | null
): Promise<ZeroRate> {
  if (rateBps === null) {
    return { count: 0, variant_ids: [] }
  }
  const rows = (await container.resolve(Modules.PRICING).listPrices(
    // A variant's own prices: on no list (`IS NULL`)
    { price_list_id: null, currency_code: [currency] } as never,
    { select: PRICE_ROW_FIELDS, take: null }
  )) as unknown as PriceRow[]
  const sets = rows
    .filter((row) => !row.price_list_id && isPlainPrice(row))
    .filter((row) => rateGivesNothing(kurusOfRow(row), rateBps))
    .map((row) => row.price_set_id)
  if (sets.length === 0) {
    return { count: 0, variant_ids: [] }
  }
  const variants = [...(await variantsBySet(container, [...new Set(sets)])).values()].sort()
  return { count: variants.length, variant_ids: variants.slice(0, NAMED) }
}
