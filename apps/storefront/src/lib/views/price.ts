import { formatLira } from "@qticaret/ui"
import type { PriceView } from "@qticaret/ui"
import type { PriceDisplay, StoreVariant } from "@qticaret/types"

/** Whether a variant can be put in the cart now (stock, or no stock kept, or backorders). */
export const isAvailable = (variant: StoreVariant): boolean =>
  variant.manage_inventory === false ||
  variant.allow_backorder === true ||
  (variant.inventory_quantity ?? 0) > 0

/** Whole percent off, rounded down so the badge never promises more than the price gives. */
export function percentOff(before: number, amount: number): number | null {
  // A display's lira string that is no number gives no badge
  if (!Number.isFinite(before) || !(before > amount) || before <= 0) {
    return null
  }
  const percent = Math.floor(((before - amount) / before) * 100)
  return percent >= 1 ? percent : null
}

/** One variant's price: Medusa's calculated price, struck through only per the 30-day rule. */
export function variantPrice(
  variant: StoreVariant,
  displays: Record<string, PriceDisplay>
): PriceView | null {
  const amount = variant.calculated_price?.calculated_amount
  if (amount === null || amount === undefined) {
    return null
  }
  const before = displays[variant.id]?.before ?? null
  return {
    current: formatLira(amount),
    before: before ? formatLira(before) : null,
    from: false,
    discount: before ? percentOff(Number(before), amount) : null,
  }
}

/**
 * A product's price on a card: its lowest, "from" when its variants
 * differ, struck through when that lowest variant's display allows it.
 */
export function cardPrice(
  variants: readonly StoreVariant[],
  displays: Record<string, PriceDisplay>
): PriceView | null {
  const priced = variants.filter(
    (variant) => typeof variant.calculated_price?.calculated_amount === "number"
  )
  const lowest = priced.reduce<StoreVariant | null>(
    (best, variant) =>
      best === null ||
      (variant.calculated_price?.calculated_amount ?? 0) <
        (best.calculated_price?.calculated_amount ?? 0)
        ? variant
        : best,
    null
  )
  if (!lowest) {
    return null
  }
  const amounts = new Set(priced.map((variant) => variant.calculated_price?.calculated_amount))
  const price = variantPrice(lowest, displays)
  return price ? { ...price, from: amounts.size > 1 } : null
}
