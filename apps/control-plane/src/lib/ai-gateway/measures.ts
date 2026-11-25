import type { OperationMeasures } from "../../modules/ai-credits/service-closing"
import type { GatewayTarget } from "./target"

/**
 * What a successful call is recorded with (adr/0085 §1, K12): the
 * service, the model, the tokens or pictures the answer reports, read on
 * a best effort, and the estimated cost from the target's price where
 * those are known (else null). Counts only: the answer's text is parsed
 * here and dropped, never kept.
 */

const MAX_COUNT = 100_000_000
// A larger JSON answer is a picture's: its usage is read too, but not past this
const MAX_PARSED_BYTES = 40 * 1024 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUNT
    ? value
    : null

function parsedJson(contentType: string, body: Buffer): Record<string, unknown> | null {
  if (!contentType.toLowerCase().startsWith("application/json") || body.length > MAX_PARSED_BYTES) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(body.toString("utf8"))
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

interface Usage {
  inputTokens: number | null
  outputTokens: number | null
  images: number | null
}

function usageOf(target: GatewayTarget, contentType: string, body: Buffer, sent: number): Usage {
  if (target.protocol === "photoroom") {
    // A picture back is the one billed (its error answers are JSON)
    return {
      inputTokens: null,
      outputTokens: null,
      images: contentType.startsWith("image/") ? 1 : null,
    }
  }
  const answer = parsedJson(contentType, body)
  if (answer === null) {
    return { inputTokens: null, outputTokens: null, images: null }
  }
  if (target.protocol === "bria") {
    // A synchronous answer names its one picture by address (`result.image_url`)
    const result = isRecord(answer["result"]) ? answer["result"] : {}
    return {
      inputTokens: null,
      outputTokens: null,
      images: typeof result["image_url"] === "string" ? 1 : null,
    }
  }
  if (target.protocol === "gemini-image") {
    const usage = isRecord(answer["usageMetadata"]) ? answer["usageMetadata"] : {}
    return {
      inputTokens: count(usage["promptTokenCount"]),
      outputTokens: count(usage["candidatesTokenCount"]),
      images: sent,
    }
  }
  const usage = isRecord(answer["usage"]) ? answer["usage"] : {}
  return {
    inputTokens: count(usage["prompt_tokens"]),
    outputTokens: count(usage["completion_tokens"]),
    images: sent > 0 ? sent : null,
  }
}

/** Millionths of a dollar, rounded up (the shop's `estimateCost`); null where it cannot be told. */
function costOf(target: GatewayTarget, usage: Usage): number | null {
  const { price } = target
  if (price === null) {
    return null
  }
  if ("perImage" in price) {
    return usage.images === null || usage.images === 0 ? null : usage.images * price.perImage
  }
  if (usage.inputTokens === null && usage.outputTokens === null) {
    return null
  }
  const total =
    (usage.inputTokens ?? 0) * price.inputPerMillionTokens +
    (usage.outputTokens ?? 0) * price.outputPerMillionTokens
  const micros = Math.ceil(total / 1_000_000)
  return Number.isSafeInteger(total) && Number.isSafeInteger(micros) ? micros : null
}

/** A 2xx answer's measures for `settle`. */
export function measuresOf(
  target: GatewayTarget,
  answer: { contentType: string; body: Buffer },
  imagesSent: number
): OperationMeasures {
  const usage = usageOf(target, answer.contentType, answer.body, imagesSent)
  return {
    service: target.service,
    model: target.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    images: usage.images,
    estimatedCostMicros: costOf(target, usage),
  }
}
