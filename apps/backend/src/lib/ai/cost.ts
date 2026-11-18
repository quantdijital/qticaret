import type { AiUsage } from "./connectors/types"
import type { AiCapability } from "./registry/capabilities"
import type { AiService, AiUnitPrice } from "./registry/services"

/**
 * What a call is estimated to have cost (adr/0071 §5), from the unit
 * prices of the registry: an estimate for the shop's usage summary,
 * never an invoice. Micro units: a millionth of the currency.
 */

export interface AiCostEstimate {
  micros: number
  currency: string
}

/** What a call used: the service's token counts, and the images it gave back. */
export interface AiCallUsage extends AiUsage {
  images?: number
}

const TOKENS_PER_UNIT = 1_000_000

const isCount = (value: number | undefined): value is number =>
  value !== undefined && Number.isSafeInteger(value) && value >= 0

/**
 * Null when the registry has no price for the capability, the call used
 * nothing the price counts (no tokens said, no image given back), a count
 * is not a whole number, or the sum would leave the range a number holds
 * exactly.
 */
export function estimateCost(
  service: AiService,
  capability: AiCapability,
  usage: AiCallUsage,
  /** The registry's own price for this call (a scene endpoint's); the capability's when left out. */
  unitPrice?: AiUnitPrice
): AiCostEstimate | null {
  const price = unitPrice ?? service.unitPrices[capability]
  if (price === undefined) {
    return null
  }
  if ("perImage" in price) {
    const { images } = usage
    if (!isCount(images) || images === 0) {
      return null
    }
    const micros = images * price.perImage
    return Number.isSafeInteger(micros) ? { micros, currency: price.currency } : null
  }
  const { inputTokens, outputTokens } = usage
  if (inputTokens === undefined && outputTokens === undefined) {
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
