import {
  DEFAULT_CONFLICT_MESSAGE,
  DEFAULT_PROVIDER_MESSAGE,
  DEFAULT_RETRYABLE_MESSAGE,
  DEFAULT_VALIDATION_MESSAGE,
  isConflictError,
  isProviderError,
  isRetryableError,
  isValidationError,
} from "./errors"

export interface HttpErrorResponse {
  status: number
  /** Same shape as Medusa's error responses; `message` is an i18n key. */
  body: { type: string; message: string; count?: number; values?: Record<string, string> }
  retryAfterSeconds?: number
}

// A provider's Retry-After passes through to our clients; it is capped so a
// provider cannot set what we tell them
const MAX_RETRY_AFTER_SECONDS = 300

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0

// A value is a few words for a sentence; anything else is not sent
const MAX_VALUES = 5
const MAX_VALUE_LENGTH = 500

/** A validation error's sentence values that are short strings, or nothing. */
function valuesOf(value: unknown): { values?: Record<string, string> } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] =>
      /^[a-z_]+$/.test(entry[0]) &&
      typeof entry[1] === "string" &&
      entry[1].length <= MAX_VALUE_LENGTH
  )
  return entries.length > 0 && entries.length <= MAX_VALUES
    ? { values: Object.fromEntries(entries) }
    : {}
}

const retryAfterSecondsOf = (ms: number): number =>
  Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil(ms / 1000)))

// `billing_profile.tax_id_invalid`: dotted snake_case, nothing else
/** What an i18n key looks like (`catalog.handle_invalid`), the only message clients get. */
export const I18N_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/

/** A `safeMessage` that is not an i18n key (say, provider text) never reaches the client. */
const clientMessage = (safeMessage: string, fallback: string): string =>
  I18N_KEY.test(safeMessage) ? safeMessage : fallback

/**
 * HTTP response for the platform's own error types, or null for anything
 * else so the caller falls back to Medusa's handler. Only the i18n key
 * leaves the server: never `cause`, the log message, the provider or its code.
 */
export function toHttpError(value: unknown): HttpErrorResponse | null {
  if (isValidationError(value)) {
    const message = clientMessage(value.safeMessage, DEFAULT_VALIDATION_MESSAGE)
    // Values go with the rule's own key only, never with the fallback's sentence
    const values = message === value.safeMessage ? valuesOf(value.values) : {}
    return { status: 400, body: { type: "invalid_data", message, ...values } }
  }
  if (isConflictError(value)) {
    const message = clientMessage(value.safeMessage, DEFAULT_CONFLICT_MESSAGE)
    // A count is a number the rule computed, never input: it passes through
    const count = isCount(value.count) ? { count: value.count } : {}
    return { status: 409, body: { type: "conflict", message, ...count } }
  }
  if (isProviderError(value)) {
    const message = clientMessage(value.safeMessage, DEFAULT_PROVIDER_MESSAGE)
    if (!value.retryable) {
      return { status: 502, body: { type: "provider_error", message } }
    }
    const response: HttpErrorResponse = {
      status: 503,
      body: { type: "provider_unavailable", message },
    }
    if (value.retryAfterMs !== undefined) {
      response.retryAfterSeconds = retryAfterSecondsOf(value.retryAfterMs)
    }
    return response
  }
  if (isRetryableError(value)) {
    const message = clientMessage(value.safeMessage, DEFAULT_RETRYABLE_MESSAGE)
    const response: HttpErrorResponse = {
      status: 503,
      body: { type: "temporarily_unavailable", message },
    }
    if (value.retryAfterMs !== undefined) {
      response.retryAfterSeconds = retryAfterSecondsOf(value.retryAfterMs)
    }
    return response
  }
  return null
}
