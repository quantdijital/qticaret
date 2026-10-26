/**
 * Money inside the platform is an integer count of kuruş (adr/0010), so sums
 * and splits never gain or lose a kuruş. Rates are basis points (20% = 2000)
 * and the only rounding rule is half-up, away from zero: the same rule
 * Medusa's MathBN uses.
 */

declare const KURUS_BRAND: unique symbol
export type Kurus = number & { readonly [KURUS_BRAND]: true }

export const BPS_PER_WHOLE = 10_000

export function kurus(value: number): Kurus {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`kuruş amount must be a safe integer, got ${String(value)}`)
  }
  // -0 would print as "-0.00" and fail strict equality checks downstream
  return (value === 0 ? 0 : value) as Kurus
}

export const ZERO_KURUS = kurus(0)

export function addKurus(a: Kurus, b: Kurus): Kurus {
  return kurus(a + b)
}

export function subtractKurus(a: Kurus, b: Kurus): Kurus {
  return kurus(a - b)
}

export function sumKurus(values: readonly Kurus[]): Kurus {
  return values.reduce(addKurus, ZERO_KURUS)
}

/** `numerator / denominator` rounded half-up, away from zero; denominator must be positive. */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const magnitude = numerator < 0n ? -numerator : numerator
  const rounded = (magnitude * 2n + denominator) / (denominator * 2n)
  return numerator < 0n ? -rounded : rounded
}

/** `amount × rate`, e.g. 2000 bps of 1.000 TL is 200 TL; exact until the final rounding. */
export function multiplyByRateBps(amount: Kurus, rateBps: number): Kurus {
  if (!Number.isSafeInteger(rateBps)) {
    throw new RangeError(`rate must be whole basis points, got ${String(rateBps)}`)
  }
  const product = BigInt(amount) * BigInt(rateBps)
  return kurus(Number(divideRoundHalfUp(product, BigInt(BPS_PER_WHOLE))))
}

/**
 * `amount × part / whole` rounded half-up: what `part` of `whole` units
 * paid, say. Taken cumulatively (what n units paid, less what n − 1 did),
 * the steps always add up to `amount`.
 */
export function prorateKurus(amount: Kurus, part: number, whole: number): Kurus {
  if (!Number.isSafeInteger(part) || !Number.isSafeInteger(whole) || whole <= 0) {
    throw new RangeError("proration needs whole numbers and a positive whole")
  }
  return kurus(Number(divideRoundHalfUp(BigInt(amount) * BigInt(part), BigInt(whole))))
}
