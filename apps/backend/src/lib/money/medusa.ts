import { MathBN } from "@medusajs/framework/utils"
import { kurus, type Kurus } from "./kurus"

const KURUS_DIGITS = 2

/** Every amount form MathBN reads: number, string, raw `{ value, precision }`, BigNumber. */
export type MedusaAmount = Parameters<typeof MathBN.convert>[0]

const DECIMAL = /^-?\d+(\.\d+)?$/

/**
 * Medusa keeps amounts as decimals in lira (20.5 = 20,50 TL; adr/0010). The
 * conversion goes through MathBN, never a float multiplication. An amount
 * with digits below a kuruş is an error unless the caller allows rounding,
 * which uses MathBN's half-up rounding.
 *
 * MathBN reads a missing value as 0 and accepts "0x10" or "1e2"; here a
 * missing amount (a field left out of a query, say) and any string other
 * than a plain decimal are errors instead.
 */
export function fromMedusaAmount(
  value: MedusaAmount,
  options: { allowRounding?: boolean } = {}
): Kurus {
  // Typed as present, but query results often reach here untyped
  if ((value as unknown) === null || (value as unknown) === undefined) {
    throw new RangeError("amount is missing")
  }
  if (typeof value === "string" && !DECIMAL.test(value)) {
    throw new RangeError("amount string must be a plain decimal such as 20.50")
  }
  const exact = MathBN.convert(value)
  if (!exact.isFinite()) {
    throw new RangeError("amount must be a finite number")
  }
  const rounded = MathBN.convert(value, KURUS_DIGITS)
  if (!rounded.eq(exact) && options.allowRounding !== true) {
    throw new RangeError("amount has digits below a kuruş; pass allowRounding to round half-up")
  }
  return kurus(rounded.shiftedBy(KURUS_DIGITS).toNumber())
}

/** Lira as a decimal string ("20.50"), which Medusa accepts wherever it takes an amount. */
export function toMedusaAmount(amount: Kurus): string {
  const magnitude = BigInt(Math.abs(amount))
  const fraction = (magnitude % 100n).toString().padStart(KURUS_DIGITS, "0")
  return `${amount < 0 ? "-" : ""}${String(magnitude / 100n)}.${fraction}`
}

const WEIGHT_DIGITS = 6

/**
 * A Medusa amount in millionths of a lira, as a weight for `allocateKurus`:
 * shares follow Medusa's exact amounts, digits below a kuruş included
 * (a 10% discount on 33.33 is 3.333). Negative amounts weigh nothing.
 */
export function weightOfMedusaAmount(value: MedusaAmount): number {
  if ((value as unknown) === null || (value as unknown) === undefined) {
    throw new RangeError("amount is missing")
  }
  const weight = MathBN.convert(value, WEIGHT_DIGITS).shiftedBy(WEIGHT_DIGITS).toNumber()
  if (!Number.isSafeInteger(weight)) {
    throw new RangeError("amount is too large to weigh")
  }
  return Math.max(weight, 0)
}
