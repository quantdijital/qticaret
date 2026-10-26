import { kurus, type Kurus } from "./kurus"

interface Share {
  index: number
  weight: number
  amount: bigint
  remainder: bigint
}

const compareBigInt = (a: bigint, b: bigint): number => (a > b ? 1 : a < b ? -1 : 0)

/**
 * Splits `total` in proportion to `weights` with the largest remainder
 * method (adr/0010): the parts always add up to `total`. Leftover kuruş go to
 * the largest fractional share, then the larger weight, then the earlier
 * position, so the result is deterministic. Weights are non-negative whole
 * numbers such as line totals in kuruş or quantities; when all are zero the
 * total is split evenly. A negative total (a refund) keeps its sign.
 */
export function allocateKurus(total: Kurus, weights: readonly number[]): Kurus[] {
  if (weights.length === 0) {
    throw new RangeError("allocation needs at least one weight")
  }
  if (!weights.every((weight) => Number.isSafeInteger(weight) && weight >= 0)) {
    throw new RangeError("allocation weights must be non-negative safe integers")
  }
  const effective = weights.every((weight) => weight === 0) ? weights.map(() => 1) : weights
  const magnitude = BigInt(Math.abs(total))
  const sign = total < 0 ? -1 : 1
  return allocateMagnitude(magnitude, effective).map((part) => kurus(sign * Number(part)))
}

function allocateMagnitude(total: bigint, weights: readonly number[]): bigint[] {
  const weightSum = weights.reduce((sum, weight) => sum + BigInt(weight), 0n)
  const shares: Share[] = weights.map((weight, index) => {
    const exact = total * BigInt(weight)
    return { index, weight, amount: exact / weightSum, remainder: exact % weightSum }
  })

  // Fewer leftover kuruş than parts remain, so each part gets at most one
  let leftover = total - shares.reduce((sum, share) => sum + share.amount, 0n)
  const byPriority = [...shares].sort(
    (a, b) => compareBigInt(b.remainder, a.remainder) || b.weight - a.weight || a.index - b.index
  )
  for (const share of byPriority) {
    if (leftover === 0n) {
      break
    }
    share.amount += 1n
    leftover -= 1n
  }
  return shares.map((share) => share.amount)
}

/**
 * Splits `total` like `allocateKurus`, but no part exceeds its cap: a part
 * whose share would pass its cap gets the cap, and what it could not take
 * goes to the others in proportion to their weights (adr/0010). A refund
 * spread over lines uses each line's refundable remainder as its cap, so
 * successive refunds never give back more on a line than it was paid.
 */
export function allocateCappedKurus(
  total: Kurus,
  weights: readonly number[],
  caps: readonly Kurus[]
): Kurus[] {
  if (weights.length !== caps.length) {
    throw new RangeError("allocation needs one cap per weight")
  }
  if (total < 0 || caps.some((cap) => cap < 0)) {
    throw new RangeError("capped allocation takes a non-negative total and caps")
  }
  if (total > caps.reduce((sum, cap) => sum + cap, 0)) {
    throw new RangeError("total exceeds what the caps allow")
  }
  const parts = caps.map(() => 0)
  let open = caps.flatMap((cap, index) => (cap > 0 ? [index] : []))
  let left: number = total
  // Each round fixes at least one part at its cap, so it ends within one round per part
  while (left > 0) {
    const shares = allocateKurus(
      kurus(left),
      open.map((index) => weights[index] ?? 0)
    )
    const over = open.filter((index, at) => (shares[at] ?? 0) > (caps[index] ?? 0))
    if (over.length === 0) {
      open.forEach((index, at) => {
        parts[index] = shares[at] ?? 0
      })
      break
    }
    for (const index of over) {
      parts[index] = caps[index] ?? 0
      left -= caps[index] ?? 0
    }
    open = open.filter((index) => !over.includes(index))
  }
  return parts.map((part) => kurus(part))
}
