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
