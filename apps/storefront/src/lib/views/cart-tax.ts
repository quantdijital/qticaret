import { formatLira } from "@qticaret/ui"
import type { TaxLinesView } from "@qticaret/ui"

/**
 * A wholesaler's cart without KDV (ADR-0068 §5), from Medusa's own
 * totals: nothing is priced here, only Medusa's amounts set side by side
 * (its KDV taken out of its total). Kuruş, so float noise never shows.
 */

const kurus = (lira: number): number => Math.round(lira * 100)

/** The totals a cart answer carries for it; the KDV ones are asked with the cart. */
export interface TaxedTotals {
  item_total: number
  item_subtotal?: number | null
  item_tax_total?: number | null
}

export interface NetTotals {
  /** Items before discounts, without KDV (Medusa's `item_subtotal`). */
  items: number
  /** What discounts take off, without KDV; zero without one. */
  discount: number
  /** The KDV on the items, after discounts (Medusa's `item_tax_total`). */
  vat: number
  /** The items after discounts, without KDV: `item_total` less its KDV. */
  net: number
}

/** The cart's totals without KDV, in kuruş; null when the answer lacks them (an older one). */
export function netTotalsOf(cart: TaxedTotals): NetTotals | null {
  const { item_subtotal: subtotal, item_tax_total: tax } = cart
  if (typeof subtotal !== "number" || typeof tax !== "number") {
    return null
  }
  const net = kurus(cart.item_total) - kurus(tax)
  const items = kurus(subtotal)
  return { items, discount: Math.max(0, items - net), vat: kurus(tax), net }
}

/** A line's total without its KDV, lira; its total as it is when the KDV is not known. */
export const lineNetOf = (line: { total: number; tax_total?: number | null }): number =>
  typeof line.tax_total === "number"
    ? (kurus(line.total) - kurus(line.tax_total)) / 100
    : line.total

/** The summary's KDV lines in words, with the note said under the totals. */
export function taxLinesOf(totals: NetTotals, note: string): TaxLinesView {
  return {
    items: formatLira(totals.items / 100),
    vat: formatLira(totals.vat / 100),
    note,
  }
}

/** The discount row's amount without KDV, in words; null without one. */
export const netDiscountOf = (totals: NetTotals): string | null =>
  totals.discount > 0 ? formatLira(totals.discount / 100) : null
