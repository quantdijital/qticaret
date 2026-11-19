import { ProviderError, ValidationError } from "../errors/errors"

/**
 * What a failed AI call becomes (adr/0071 §9, §12): an `ai.*` key, the
 * HTTP status or a registered code, and nothing else. The service's
 * answer and the request's headers never enter the error (some services
 * write part of the key back), so there is no `cause` and no provider
 * text here on purpose.
 */

export const AI_ERROR_KEYS = [
  "ai.no_service",
  "ai.service_unavailable",
  "ai.own_keys_not_in_plan",
  "ai.key_rejected",
  "ai.provider_balance",
  "ai.provider_busy",
  // A 429 whose body says the account's quota for this job is used up or zero, not a rate
  "ai.provider_quota",
  "ai.provider_unavailable",
  "ai.timeout",
  "ai.content_blocked",
  "ai.suggestion_refused",
  "ai.provider_response_invalid",
  "ai.input_unsupported",
  "ai.daily_limit_reached",
  "ai.credits_exhausted",
  "ai.unknown_entity",
  "ai.unknown_task",
  "ai.suggestion_not_open",
  // Aşama 9: reviews and questions
  "ai.reviews_off",
  "ai.not_enough_reviews",
  // Aşama 7: a scene the shop wrote (lib/ai/scene-text.ts)
  "ai.scene_text_invalid",
  "ai.scenes_full",
] as const

export type AiErrorKey = (typeof AI_ERROR_KEYS)[number]

/** The service said it did not take the job: the only failures tried again (§8). */
const RETRYABLE: ReadonlySet<AiErrorKey> = new Set(["ai.provider_busy", "ai.provider_unavailable"])

export const isRetryableAiError = (key: AiErrorKey): boolean => RETRYABLE.has(key)

/** What an HTTP status of a service means; null for a success. */
export function aiErrorForStatus(status: number): AiErrorKey | null {
  if (status >= 200 && status < 300) {
    return null
  }
  if (status === 401 || status === 403) {
    return "ai.key_rejected"
  }
  if (status === 402) {
    return "ai.provider_balance"
  }
  if (status === 408) {
    return "ai.timeout"
  }
  if (status === 429) {
    return "ai.provider_busy"
  }
  if (status >= 500) {
    return "ai.provider_unavailable"
  }
  return "ai.provider_response_invalid"
}

export interface AiProviderFailure {
  service: string
  key: AiErrorKey
  /** A short code of ours for logs: `http_429`, `body_1004`, `timeout`. Never the service's text. */
  code: string
  retryAfterMs?: number | undefined
  /** The usable services but the failed one, for "try with another service" (§4). */
  alternatives?: readonly string[] | undefined
}

/**
 * A failed call to a service, with what the panel may show and nothing the
 * service said. Never `retryable`: the connector has already used the one
 * retry the rules allow (§8), and a layer above must not add its own.
 */
export function aiProviderError(failure: AiProviderFailure): ProviderError {
  return new ProviderError({
    provider: failure.service,
    providerCode: failure.code,
    retryable: false,
    safeMessage: failure.key,
    ...(failure.retryAfterMs === undefined ? {} : { retryAfterMs: failure.retryAfterMs }),
    ...(failure.alternatives === undefined ? {} : { alternatives: failure.alternatives }),
  })
}

/** A request the core refuses on its own rules (no service, unknown task). */
export const aiValidationError = (key: AiErrorKey): ValidationError => new ValidationError(key)
