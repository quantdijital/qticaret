import { kurus } from "../../money"
import type { Kurus } from "../../money"

/**
 * iyzico writes prices as lira text. The sandbox took "10.5" and "10.50"
 * alike (2026-10-27); we send two decimals. Answers carry JSON numbers.
 */

export const toIyzicoPrice = (amount: Kurus): string =>
  `${String(Math.floor(amount / 100))}.${String(amount % 100).padStart(2, "0")}`

const LIRA = /^(\d{1,12})(?:\.(\d{1,2}))?$/

/** Lira as an answer gives it, a number or text with at most two decimals; anything else is refused. */
export function parseIyzicoPrice(value: string | number): Kurus {
  const match = LIRA.exec(typeof value === "number" ? String(value) : value)
  if (!match) {
    throw new RangeError("an iyzico price has at most two decimals")
  }
  return kurus(Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")))
}
