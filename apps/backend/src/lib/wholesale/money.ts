import { BPS_PER_WHOLE, multiplyByRateBps, prorateKurus } from "../money"
import type { Kurus } from "../money"
import { vatHundredths } from "../tax"

/**
 * Wholesale price arithmetic (ADR-0068 §4, adr/0010): integer kuruş, one
 * rounding per step, half-up. The shop's prices include KDV (adr/0007);
 * a wholesale price is entered without it and stored with it.
 */

/** The highest rate a level or a wholesaler may take off: 99%, as a price list's percentage. */
export const MAX_RATE_BPS = 9_900

/** A percentage with up to two decimals (12.5) in basis points (1250). */
export const percentToBps = (percent: number): number => Math.round(percent * 100)

/** Basis points as the percentage the panel shows (1250 → 12.5). */
export const bpsToPercent = (bps: number): number => bps / 100

/**
 * The rate's price for a variant: its own (KDV-included) price less the
 * rate, rounded half-up to the kuruş, as a price list's percentage is
 * (`discount-price-list.ts`). A rate off the gross price is the same rate
 * off the net one, so KDV plays no part.
 */
export function ratePrice(base: Kurus, rateBps: number): Kurus {
  if (!Number.isInteger(rateBps) || rateBps <= 0 || rateBps > MAX_RATE_BPS) {
    throw new RangeError(`wholesale rate must be 1..${String(MAX_RATE_BPS)} bps`)
  }
  return multiplyByRateBps(base, BPS_PER_WHOLE - rateBps)
}

/** A KDV rate in percent (20, 1, 10) as basis points (2000, 100, 1000). */
export const vatBps = (ratePercent: number): number => vatHundredths(ratePercent)

function checkVat(bps: number): void {
  if (!Number.isSafeInteger(bps) || bps < 0) {
    throw new RangeError("KDV rate must be whole basis points, zero or more")
  }
}

/** The KDV-included price of a net one: `net × (1 + rate)`, half-up to the kuruş. */
export function grossOfNet(net: Kurus, vat: number): Kurus {
  checkVat(vat)
  return prorateKurus(net, BPS_PER_WHOLE + vat, BPS_PER_WHOLE)
}

/**
 * The net price of a KDV-included one: `gross ÷ (1 + rate)`, half-up. For
 * any net price, `netOfGross(grossOfNet(net))` is `net` again: the gross
 * price is off by at most half a kuruş, and dividing by more than one
 * makes that smaller still, so it never reaches the next kuruş.
 */
export function netOfGross(gross: Kurus, vat: number): Kurus {
  checkVat(vat)
  return prorateKurus(gross, BPS_PER_WHOLE, BPS_PER_WHOLE + vat)
}

/**
 * A price Medusa calculated, as the wholesaler is shown it (ADR-0068 §5):
 * without KDV and with it. A KDV-included price (the shop's, adr/0007)
 * gives its net by `netOfGross`, so a hand-entered net price comes back to
 * the kuruş it was entered as; a price without KDV gives its gross.
 */
export function shownWholesale(
  amount: Kurus,
  taxInclusive: boolean,
  vat: number
): { net: Kurus; gross: Kurus } {
  return taxInclusive
    ? { net: netOfGross(amount, vat), gross: amount }
    : { net: amount, gross: grossOfNet(amount, vat) }
}
