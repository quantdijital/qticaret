import { isProviderError, isRetryableError, isValidationError } from "./errors"

export interface HttpErrorResponse {
  status: number
  /** Same shape as Medusa's error responses; `message` is an i18n key. */
  body: { type: string; message: string }
  retryAfterSeconds?: number
}

/**
 * HTTP response for the platform's own error types, or null for anything
 * else so the caller falls back to Medusa's handler. Only `safeMessage`
 * leaves the server: never `cause`, the log message, the provider or its code.
 */
export function toHttpError(value: unknown): HttpErrorResponse | null {
  if (isValidationError(value)) {
    return { status: 400, body: { type: "invalid_data", message: value.safeMessage } }
  }
  if (isProviderError(value)) {
    return value.retryable
      ? { status: 503, body: { type: "provider_unavailable", message: value.safeMessage } }
      : { status: 502, body: { type: "provider_error", message: value.safeMessage } }
  }
  if (isRetryableError(value)) {
    const response: HttpErrorResponse = {
      status: 503,
      body: { type: "temporarily_unavailable", message: value.safeMessage },
    }
    if (value.retryAfterMs !== undefined) {
      response.retryAfterSeconds = Math.max(1, Math.ceil(value.retryAfterMs / 1000))
    }
    return response
  }
  return null
}
