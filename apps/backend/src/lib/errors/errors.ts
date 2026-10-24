/**
 * Error types shared by workflows, routes and provider clients (docs/10).
 * `message` is for logs only; `safeMessage` is an i18n key that may reach
 * the client. A workflow run hands thrown errors back as plain objects, so
 * the kind travels as an own property and the guards check shape, never
 * `instanceof`.
 */

export const ERROR_KINDS = ["validation", "provider", "retryable"] as const
export type ErrorKind = (typeof ERROR_KINDS)[number]

export const DEFAULT_PROVIDER_MESSAGE = "errors.provider_unavailable"
export const DEFAULT_RETRYABLE_MESSAGE = "errors.temporarily_unavailable"

interface ErrorShape<K extends ErrorKind> {
  readonly qtErrorKind: K
  readonly safeMessage: string
  readonly message: string
}

export interface ValidationErrorShape extends ErrorShape<"validation"> {
  readonly field?: string
}

export interface ProviderErrorShape extends ErrorShape<"provider"> {
  readonly provider: string
  readonly code: string
  readonly retryable: boolean
}

export interface RetryableErrorShape extends ErrorShape<"retryable"> {
  readonly retryAfterMs?: number
}

const causeOf = (options: { cause?: unknown }): ErrorOptions | undefined =>
  "cause" in options ? { cause: options.cause } : undefined

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
  /** The provider's own error code, for logs and support; never shown to users. */
  code: string
  retryable: boolean
  safeMessage?: string
  cause?: unknown
}

/** A failed call to an external service; the raw response stays in `cause`. */
export class ProviderError extends Error implements ProviderErrorShape {
  override readonly name = "ProviderError"
  readonly qtErrorKind = "provider"
  readonly provider: string
  readonly code: string
  readonly retryable: boolean
  readonly safeMessage: string

  constructor(init: ProviderErrorInit) {
    super(`${init.provider} error ${init.code}`, causeOf(init))
    this.provider = init.provider
    this.code = init.code
    this.retryable = init.retryable
    this.safeMessage = init.safeMessage ?? DEFAULT_PROVIDER_MESSAGE
  }
}

/** A temporary failure (lock contention, overload) that may succeed if tried again. */
export class RetryableError extends Error implements RetryableErrorShape {
  override readonly name = "RetryableError"
  readonly qtErrorKind = "retryable"
  readonly safeMessage: string
  readonly retryAfterMs?: number

  constructor(
    safeMessage: string = DEFAULT_RETRYABLE_MESSAGE,
    options: { retryAfterMs?: number; cause?: unknown } = {}
  ) {
    super(`temporary failure: ${safeMessage}`, causeOf(options))
    this.safeMessage = safeMessage
    if (options.retryAfterMs !== undefined) {
      this.retryAfterMs = options.retryAfterMs
    }
  }
}

const fieldsOf = (value: unknown, kind: ErrorKind): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null) {
    return null
  }
  const fields = value as Record<string, unknown>
  return fields["qtErrorKind"] === kind &&
    typeof fields["safeMessage"] === "string" &&
    typeof fields["message"] === "string"
    ? fields
    : null
}

const isOptional = (value: unknown, type: "string" | "number"): boolean =>
  value === undefined || typeof value === type

export function isValidationError(value: unknown): value is ValidationErrorShape {
  const fields = fieldsOf(value, "validation")
  return fields !== null && isOptional(fields["field"], "string")
}

export function isProviderError(value: unknown): value is ProviderErrorShape {
  const fields = fieldsOf(value, "provider")
  return (
    fields !== null &&
    typeof fields["provider"] === "string" &&
    typeof fields["code"] === "string" &&
    typeof fields["retryable"] === "boolean"
  )
}

export function isRetryableError(value: unknown): value is RetryableErrorShape {
  const fields = fieldsOf(value, "retryable")
  return fields !== null && isOptional(fields["retryAfterMs"], "number")
}

/** True for a retryable provider failure or a `RetryableError`. */
export function isRetryable(value: unknown): boolean {
  return (isProviderError(value) && value.retryable) || isRetryableError(value)
}
