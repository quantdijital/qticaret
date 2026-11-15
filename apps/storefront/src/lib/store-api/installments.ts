import "server-only"
import type { InstallmentSummaryView } from "@qticaret/ui"
import type { PriceDisplay, StoreProduct } from "@qticaret/types"
import { installmentSummary } from "../views/installments"
import type { InstallmentTable } from "../views/installments"
import { isAvailable, isVatExclusive, shownAmount } from "../views/price"
import { isStoreApiError } from "./errors"
import { liraRegion } from "./requests"
import { storePublicGet } from "./server"

/**
 * A variant's installment table from the backend (F5 V6), shop-wide: the
 * backend prices it from the variant's price now, never the shopper's
 * word, and asks the card provider for its rates once a day (PayTR) or
 * per amount for a few minutes (iyzico). Null when it does not answer.
 */

const PATH = "/store/payment/installments"
// The line under the price: kept ten minutes per variant and price, so a
// product page asks the backend once, not on every view; a new price asks again
const SUMMARY_TTL_MS = 10 * 60 * 1000

/** One variant's table; `kept`: longer than the shared minute, under its price. */
export async function variantInstallments(
  variantId: string,
  kept?: { ttlMs: number; key: string }
): Promise<InstallmentTable | null> {
  try {
    const { id: region_id } = await liraRegion()
    const { installments } = await storePublicGet<{ installments: InstallmentTable }>(
      PATH,
      { variant_id: variantId, region_id },
      kept
    )
    return installments
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/**
 * The line under the price for each variant to be had, by variant id:
 * asked once per price the product's variants share (their colours
 * mostly cost the same), from the price the page shows.
 */
export async function installmentSummaries(
  product: StoreProduct,
  displays: Readonly<Record<string, PriceDisplay>>
): Promise<Record<string, InstallmentSummaryView>> {
  const byPrice = new Map<number, string[]>()
  for (const variant of product.variants ?? []) {
    // The shop-wide table is the retail price's: none under a wholesaler's own (ADR-0068 §7)
    if (isVatExclusive(variant, displays)) {
      continue
    }
    const amount = shownAmount(variant, displays)
    if (amount !== null && amount > 0 && isAvailable(variant)) {
      byPrice.set(amount, [...(byPrice.get(amount) ?? []), variant.id])
    }
  }
  const found = await Promise.all(
    [...byPrice].map(async ([amount, ids]) => {
      const first = ids[0] ?? ""
      const table = await variantInstallments(first, {
        ttlMs: SUMMARY_TTL_MS,
        key: amount.toFixed(2),
      })
      const summary = table ? installmentSummary(table) : null
      return summary ? ids.map((id) => [id, summary] as const) : []
    })
  )
  return Object.fromEntries(found.flat())
}
