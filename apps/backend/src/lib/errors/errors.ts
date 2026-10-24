/**
 * Error types shared by workflows, routes and provider clients (docs/10).
 * `message` is for logs only; `safeMessage` is an i18n key that may reach
 * the client. A workflow run hands thrown errors back as plain objects (and
 * a JSON round trip drops `message`), so the kind travels as an own property
 * and the guards check shape, never `instanceof`.
 */

export type ErrorKind = "validation" | "provider" | "retryable"

export const DEFAULT_VALIDATION_MESSAGE = "errors.invalid_data"
export const DEFAULT_PROVIDER_MESSAGE = "errors.provider_unavailable"
export const DEFAULT_RETRYABLE_MESSAGE = "errors.temporarily_unavailable"

interface ErrorShape<K extends ErrorKind> {
  readonly qtErrorKind: K
  readonly safeMessage: string
}

export interface ValidationErrorShape extends ErrorShape<"validation"> {
  readonly field?: string
}

export interface ProviderErrorShape extends ErrorShape<"provider"> {
  readonly provider: string
  readonly providerCode: string
  readonly retryable: boolean
  /** How long the provider asked us to wait (its Retry-After). */
  readonly retryAfterMs?: number
}

export interface RetryableErrorShape extends ErrorShape<"retryable"> {
  readonly retryAfterMs?: number
}

const causeOf = (options: { cause?: unknown }): ErrorOptions | undefined =>
  "cause" in options ? { cause: options.cause } : undefined

const isDelay = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0

/** Input the platform rejects on its own rules (not schema validation, which Zod does). */
export class ValidationError extends Error implements ValidationErrorShape {
  override readonly name = "ValidationError"
  readonly qtErrorKind = "validation"
  readonly safeMessage: string
  readonly field?: string

  constructor(safeMessage: string, options: { field?: string; cause?: unknown } = {}) {
    super(`validation failed: ${safeMessage}`, causeOf(options))
    this.safeMessage = safeMessage
    if (options.field !== undefined) {
      this.field = options.field
    }
  }
}

export interface ProviderErrorInit {
  provider: string
  /**
   * The provider's own error code, for logs and support. Not named `code`:
   * Medusa's error handler copies `error.code` into the response body.
   */
  providerCode: string
  retryable: boolean
  safeMessage?: string
  /** Dropped unless a finite, non-negative number. */
  retryAfterMs?: number
  cause?: unknown
}

/** A failed call to an external service; the raw response stays in `cause`. */
export class ProviderError extends Error implements ProviderErrorShape {
  override readonly name = "ProviderError"
  readonly qtErrorKind = "provider"
  readonly provider: string
  readonly providerCode: string
  readonly retryable: boolean
  readonly safeMessage: string
  readonly retryAfterMs?: number

  constructor(init: ProviderErrorInit) {
    super(`${init.provider} error ${init.providerCode}`, causeOf(init))
    this.provider = init.provider
    this.providerCode = init.providerCode
    this.retryable = init.retryable
    this.safeMessage = init.safeMessage ?? DEFAULT_PROVIDER_MESSAGE
    if (isDelay(init.retryAfterMs)) {
      this.retryAfterMs = init.retryAfterMs
    }
  }
}

/** A temporary failure (lock contention, overload) that may succeed if tried again. */
export class RetryableError extends Error implements RetryableErrorShape {
  override readonly name = "RetryableError"
  readonly qtErrorKind = "retryable"
  readonly safeMessage: string
  readonly retryAfterMs?: number

  /** A `retryAfterMs` that is not a finite, non-negative number is dropped. */
  constructor(
    safeMessage: string = DEFAULT_RETRYABLE_MESSAGE,
    options: { retryAfterMs?: number; cause?: unknown } = {}
  ) {
    super(`temporary failure: ${safeMessage}`, causeOf(options))
    this.safeMessage = safeMessage
    if (isDelay(options.retryAfterMs)) {
      this.retryAfterMs = options.retryAfterMs
    }
  }
}

const fieldsOf = (value: unknown, kind: ErrorKind): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null) {
    return null
  }
  const fields = value as Record<string, unknown>
  return fields["qtErrorKind"] === kind && typeof fields["safeMessage"] === "string" ? fields : null
}

export function isValidationError(value: unknown): value is ValidationErrorShape {
  const fields = fieldsOf(value, "validation")
  return fields !== null && (fields["field"] === undefined || typeof fields["field"] === "string")
}

export function isProviderError(value: unknown): value is ProviderErrorShape {
  const fields = fieldsOf(value, "provider")
  return (
    fields !== null &&
    typeof fields["provider"] === "string" &&
    typeof fields["providerCode"] === "string" &&
    typeof fields["retryable"] === "boolean" &&
    (fields["retryAfterMs"] === undefined || isDelay(fields["retryAfterMs"]))
  )
}

export function isRetryableError(value: unknown): value is RetryableErrorShape {
  const fields = fieldsOf(value, "retryable")
  return (
    fields !== null && (fields["retryAfterMs"] === undefined || isDelay(fields["retryAfterMs"]))
  )
}

/** True for a retryable provider failure or a `RetryableError`. */
export function isRetryable(value: unknown): boolean {
  return (isProviderError(value) && value.retryable) || isRetryableError(value)
}
