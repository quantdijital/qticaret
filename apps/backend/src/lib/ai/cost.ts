import type { AiUsage } from "./connectors/types"
import type { AiCapability } from "./registry/capabilities"
import type { AiService } from "./registry/services"

/**
 * What a call is estimated to have cost (adr/0071 §5), from the unit
 * prices of the registry: an estimate for the shop's usage summary,
 * never an invoice. Micro units: a millionth of the currency.
 */

export interface AiCostEstimate {
  micros: number
  currency: string
}

const TOKENS_PER_UNIT = 1_000_000

/** Null when the service says no counts or the registry has no price for the capability. */
export function estimateCost(
  service: AiService,
  capability: AiCapability,
  usage: AiUsage
): AiCostEstimate | null {
  const price = service.unitPrices[capability]
  if (
    price === undefined ||
    (usage.inputTokens === undefined && usage.outputTokens === undefined)
  ) {
    return null
  }
  const micros =
    ((usage.inputTokens ?? 0) * price.inputPerMillionTokens +
      (usage.outputTokens ?? 0) * price.outputPerMillionTokens) /
    TOKENS_PER_UNIT
  // Rounded up: an estimate shown to the shop should not undercount
  return { micros: Math.ceil(micros), currency: price.currency }
}
