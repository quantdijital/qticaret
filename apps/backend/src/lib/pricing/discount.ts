import type { Kurus } from "../money"

/**
 * The price shown before a discount (F4.3, ADR-0023): the lowest price that
 * applied in the 30 days before the discount began. A discount that only
 * deepens (100 → 90 → 80) is one discount that began at its first step, so
 * the price before it stays what it was before the first (the reading the
 * EU's Omnibus rule gives progressive reductions). The Turkish price label
 * rule is to be confirmed by a lawyer (docs/12); the version names the
 * reading in force, and this file is the one place it changes.
 */
export const DISCOUNT_RULE = { version: "tr-30d-1", windowDays: 30 } as const

const DAY_MS = 24 * 60 * 60 * 1000

/** A selling price from a moment on: what was paid, and the regular price beside it. */
export interface PricePoint {
  at: Date
  amount: Kurus
  original: Kurus
}

export interface DiscountView {
  current: Kurus
  regular: Kurus
  discounted: boolean
  /** When the discount began; null when there is none. */
  since: Date | null
  /** The price shown struck through; null when there is no discount. */
  before: Kurus | null
  /**
   * Where `before` comes from: the history of the window, or the regular
   * price when no price is known from before the discount (a shop whose
   * history begins inside it).
   */
  basis: "history" | "regular" | null
  rule: typeof DISCOUNT_RULE.version
}

const isDiscounted = (point: PricePoint) => point.amount < point.original

/**
 * The discount view of a variant's prices in one currency, oldest first
 * (what `pricesSince` reads from the window's start). Null without prices.
 */
export function discountView(points: readonly PricePoint[]): DiscountView | null {
  const last = points.at(-1)
  if (!last) {
    return null
  }
  const base = { current: last.amount, regular: last.original, rule: DISCOUNT_RULE.version }
  if (!isDiscounted(last)) {
    return { ...base, discounted: false, since: null, before: null, basis: null }
  }
  // The discount's first point: the run of discounted prices up to now
  let start = points.length - 1
  for (let previous = points[start - 1]; previous && isDiscounted(previous);) {
    start -= 1
    previous = points[start - 1]
  }
  const since = points[start]?.at ?? last.at
  const windowStart = since.getTime() - DISCOUNT_RULE.windowDays * DAY_MS
  // What applied in the window: a price applies until the next one is set
  const inForce = points.slice(0, start).filter((point, index, before) => {
    const until = before[index + 1]?.at ?? since
    return until.getTime() > windowStart
  })
  if (inForce.length === 0) {
    return { ...base, discounted: true, since, before: last.original, basis: "regular" }
  }
  const lowest = Math.min(...inForce.map((point) => point.amount)) as Kurus
  return { ...base, discounted: true, since, before: lowest, basis: "history" }
}
