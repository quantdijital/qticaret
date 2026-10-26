import type { Kurus } from "../money"
import { DISCOUNT_RULE, discountView } from "./discount"
import type { PricePoint } from "./discount"

/**
 * How a variant's price is shown (F4.3, ADR-0023), for the storefront and
 * the page's structured data alike: what it costs now, and, only when it
 * is a discount the 30-day rule allows to show, the price struck through.
 */
export interface PriceDisplay {
  current: Kurus
  /** The price without any sale: Medusa's original amount. */
  regular: Kurus
  /** Shown struck through; null when the price is not shown as a discount. */
  before: Kurus | null
  on_sale: boolean
  /** When the discount began; null when there is none. */
  since: Date | null
  basis: "history" | "regular" | null
  rule_version: typeof DISCOUNT_RULE.version
}

/**
 * The display from a variant's recorded prices (oldest first) and what it
 * sells at now. The history is written by events and an hourly check, so
 * it can trail a list that just began; the live price then counts as a
 * point of its own from now.
 *
 * A discount is shown only when the price before it is above the current
 * one: a price raised and then cut back within 30 days is no discount to
 * advertise, whatever the regular price says.
 */
export function priceDisplay(
  history: readonly PricePoint[],
  live: { amount: Kurus; original: Kurus },
  now: Date
): PriceDisplay {
  const last = history.at(-1)
  const points =
    last?.amount === live.amount && last.original === live.original
      ? history
      : [...history, { at: now, amount: live.amount, original: live.original }]
  const view = discountView(points)
  const before = view?.before ?? null
  const onSale = Boolean(view?.discounted) && before !== null && before > live.amount
  return {
    current: live.amount,
    regular: live.original,
    before: onSale ? before : null,
    on_sale: onSale,
    since: onSale ? (view?.since ?? null) : null,
    basis: onSale ? (view?.basis ?? null) : null,
    rule_version: DISCOUNT_RULE.version,
  }
}
