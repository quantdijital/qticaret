import type { PriceDisplay } from "@qticaret/types"

/**
 * The shopper's wholesale state, carried with the price displays it made
 * (security review L2, ADR-0068 §7): a signed-in wholesaler's displays
 * are their own, and a variant left out of them has no price for them;
 * it never falls back to the KDV-included price Medusa gives their groups.
 * A symbol: no list, copy to JSON or walk of the displays sees it, so
 * every other shopper's displays, and what is drawn from them, are as before.
 */
const WHOLESALE = Symbol.for("qticaret.wholesale-displays")

type Displays = Readonly<Record<string, PriceDisplay>>

/** The displays marked as a wholesaler's. */
export function markWholesale<T extends Record<string, PriceDisplay>>(displays: T): T {
  Object.defineProperty(displays, WHOLESALE, { value: true, enumerable: false })
  return displays
}

/** Whether these displays are a signed-in wholesaler's (`markWholesale`). */
export const isWholesaleDisplays = (displays: Displays): boolean =>
  (displays as Record<symbol, unknown>)[WHOLESALE] === true
