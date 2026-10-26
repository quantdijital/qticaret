import type { PriceDisplayView, PricePointRow } from "./api/price-history"

/** One step of the price line: from `at` on, what was paid and the price without a sale. */
export interface PriceStep {
  at: number
  paid: number
  regular: number
}

/**
 * The steps of a variant's price over the window, each change and today
 * with the price now, so the line reaches the right edge. Pure, so tested
 * on its own.
 */
export function priceSteps(
  points: readonly PricePointRow[],
  display: Pick<PriceDisplayView, "current" | "regular"> | null,
  now: Date
): PriceStep[] {
  const steps = points.map((point) => ({
    at: new Date(point.at).getTime(),
    paid: Number(point.amount),
    regular: Number(point.original),
  }))
  if (display) {
    steps.push({
      at: now.getTime(),
      paid: Number(display.current),
      regular: Number(display.regular),
    })
  } else if (steps.length > 0) {
    const last = steps[steps.length - 1]
    if (last) {
      steps.push({ ...last, at: now.getTime() })
    }
  }
  return steps
}

/**
 * What the 30-day rule makes of today's price: no discount, a discount
 * struck through, or a discount that is not, because the price was as low
 * within the 30 days before it.
 */
export type RuleState = "none" | "struck" | "blocked"

export function ruleState(display: PriceDisplayView): RuleState {
  if (display.on_sale) {
    return "struck"
  }
  return Number(display.current) < Number(display.regular) ? "blocked" : "none"
}
