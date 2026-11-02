/**
 * Which products are on sale now (adr/0019 ek 2026-11-03, `/kampanyalar`).
 * A variant is marked down when Medusa prices it below its original amount
 * (a sale price list; an override list sets both alike, a promotion only
 * applies in a cart). The page lists only what the storefront shows as a
 * discount: the 30-day rule's `on_sale` (ADR-0023), so a price raised and
 * cut back is no campaign. Pure: the caller prices the variants.
 */

export interface CalculatedPrice {
  calculated_amount?: number | string | null
  original_amount?: number | string | null
}

const amountOf = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

/** Whether a variant sells below its original price now; a missing amount is no sale. */
export function isMarkedDown(price: CalculatedPrice | null | undefined): boolean {
  const current = amountOf(price?.calculated_amount)
  const original = amountOf(price?.original_amount)
  return current !== null && original !== null && current < original
}

/**
 * The products with a variant shown as a discount, each once, in the
 * order their variants come; a variant without a display is not on sale.
 */
export function saleProducts(
  variants: readonly { id: string; product_id: string }[],
  displays: ReadonlyMap<string, { on_sale: boolean }>
): string[] {
  const products = new Set<string>()
  for (const variant of variants) {
    if (displays.get(variant.id)?.on_sale) {
      products.add(variant.product_id)
    }
  }
  return [...products]
}
