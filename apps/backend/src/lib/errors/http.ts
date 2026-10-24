import {
  DEFAULT_PROVIDER_MESSAGE,
  DEFAULT_RETRYABLE_MESSAGE,
  DEFAULT_VALIDATION_MESSAGE,
  isProviderError,
  isRetryableError,
  isValidationError,
} from "./errors"

export interface HttpErrorResponse {
  status: number
  /** Same shape as Medusa's error responses; `message` is an i18n key. */
  body: { type: string; message: string }
  retryAfterSeconds?: number
}

// `billing_profile.tax_id_invalid`: dotted snake_case, nothing else
const I18N_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/

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
    return { status: 400, body: { type: "invalid_data", message } }
  }
  if (isProviderError(value)) {
    const message = clientMessage(value.safeMessage, DEFAULT_PROVIDER_MESSAGE)
    return value.retryable
      ? { status: 503, body: { type: "provider_unavailable", message } }
      : { status: 502, body: { type: "provider_error", message } }
  }
  if (isRetryableError(value)) {
    const message = clientMessage(value.safeMessage, DEFAULT_RETRYABLE_MESSAGE)
    const response: HttpErrorResponse = {
      status: 503,
      body: { type: "temporarily_unavailable", message },
    }
    if (value.retryAfterMs !== undefined) {
      response.retryAfterSeconds = Math.max(1, Math.ceil(value.retryAfterMs / 1000))
    }
    return response
  }
  return null
}
