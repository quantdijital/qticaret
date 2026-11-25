import type { AiCharge } from "../../lib/ai/transport/types"

/**
 * The credits each call of a run was charged, as the gateway's headers
 * said (adr/0085 §3): the shop never works a charge out. Given to
 * `transportFor` as its `onCharge`; told in the order the calls were
 * made. A run's calls go one after another and every call but the last
 * was answered (an answer on credits always names its charge), so the
 * n-th charge told is the n-th call's: a text task's first call and its
 * correction, an assistant turn's model calls. A call the gateway named
 * no charge for (no answer, the shop's own key) reads as null.
 */
export interface ChargeTally {
  onCharge: (charge: AiCharge) => void
  /** The credits the call at `index` was charged; null when none was named. */
  at: (index: number) => number | null
  /** The run's calls together (an image edit's); null when none was named. */
  total: () => number | null
}

export function chargeTally(): ChargeTally {
  const charges: number[] = []
  return {
    onCharge: (charge) => {
      charges.push(charge.credits)
    },
    at: (index) => charges[index] ?? null,
    total: () => (charges.length === 0 ? null : charges.reduce((sum, each) => sum + each, 0)),
  }
}
