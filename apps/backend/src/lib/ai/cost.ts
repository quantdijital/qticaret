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

const isCount = (value: number | undefined): value is number =>
  value !== undefined && Number.isSafeInteger(value) && value >= 0

/**
 * Null when the service gave no counts, a count is not a whole number of
 * tokens, the registry has no price for the capability, or the sum would
 * leave the range a number holds exactly.
 */
export function estimateCost(
  service: AiService,
  capability: AiCapability,
  usage: AiUsage
): AiCostEstimate | null {
  const price = service.unitPrices[capability]
  const { inputTokens, outputTokens } = usage
  if (price === undefined || (inputTokens === undefined && outputTokens === undefined)) {
    return null
  }
  if (
    (inputTokens !== undefined && !isCount(inputTokens)) ||
    (outputTokens !== undefined && !isCount(outputTokens))
  ) {
    return null
  }
  const total =
    (inputTokens ?? 0) * price.inputPerMillionTokens +
    (outputTokens ?? 0) * price.outputPerMillionTokens
  // Rounded up: an estimate shown to the shop should not undercount
  const micros = Math.ceil(total / TOKENS_PER_UNIT)
  return Number.isSafeInteger(total) && Number.isSafeInteger(micros)
    ? { micros, currency: price.currency }
    : null
}
