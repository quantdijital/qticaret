import { kurus } from "../money"
import type { Kurus } from "../money"

/**
 * What the storefront shows of each product's price (adr/0019 ek
 * 2026-11-03, adr/0023 Ek 2026-11-05), for the search index's listings:
 * whether it is on sale now (`/kampanyalar`) and its lowest price. On sale
 * is a variant whose display is `on_sale` (a sale price list, or an
 * automatic promotion every shopper gets), by the price-before rule, so a
 * price raised and cut back is no campaign. The lowest is the lowest
 * `current`, the price the cards show, so listings filter and sort by it.
 * Pure: the caller works out the variants' displays.
 */

export interface ProductShown {
  on_sale: boolean
  /** The lowest shown price; null when no variant has one in the currency. */
  lowest: Kurus | null
}

/**
 * Each product with a display, from its variants' displays; a variant
 * without one (no price in the currency) adds nothing.
 */
export function shownByProduct(
  variants: readonly { id: string; product_id: string }[],
  displays: ReadonlyMap<string, { on_sale: boolean; current: Kurus }>
): Map<string, ProductShown> {
  const products = new Map<string, ProductShown>()
  for (const variant of variants) {
    const display = displays.get(variant.id)
    if (!display) {
      continue
    }
    const known = products.get(variant.product_id)
    products.set(variant.product_id, {
      on_sale: (known?.on_sale ?? false) || display.on_sale,
      lowest:
        known?.lowest === null || known?.lowest === undefined
          ? display.current
          : kurus(Math.min(known.lowest, display.current)),
    })
  }
  return products
}
