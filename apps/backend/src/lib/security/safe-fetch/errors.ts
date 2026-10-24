export type SafeFetchFailure =
  | "invalid_url"
  | "protocol_not_allowed"
  | "credentials_in_url"
  | "port_not_allowed"
  | "address_not_allowed"
  | "dns_failed"
  | "too_many_redirects"
  | "redirect_not_allowed"
  | "response_too_large"
  | "timeout"
  | "aborted"
  | "request_failed"

/**
 * Why `safeFetch` refused or failed. Callers translate it: a refused URL
 * from user input becomes a `ValidationError`, a network failure a
 * `ProviderError` (lib/errors). The message names the reason only, never
 * the URL, which may carry tokens.
 */
export class SafeFetchError extends Error {
  override readonly name = "SafeFetchError"
  readonly reason: SafeFetchFailure

  constructor(reason: SafeFetchFailure, options: { cause?: unknown } = {}) {
    super(
      `safe-fetch refused: ${reason}`,
      "cause" in options ? { cause: options.cause } : undefined
    )
    this.reason = reason
  }
}

/** Shape check: a workflow hands thrown errors back as plain objects (docs/10). */
export function isSafeFetchError(value: unknown): value is Pick<SafeFetchError, "name" | "reason"> {
  const fields = value as { name?: unknown; reason?: unknown } | null
  return fields?.name === "SafeFetchError" && typeof fields.reason === "string"
}
