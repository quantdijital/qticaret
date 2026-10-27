import { ProviderError } from "../../errors"

/**
 * Geliver's errors and the platform's code for each (adr/0031). Geliver
 * answers a refused call with `{ result: false, code, message }`; its codes
 * are not documented yet, so a code is kept visible as `error_<code>` and
 * the status stands for the rest. `message` is never logged or shown: it
 * can quote an address.
 */

export const GELIVER_PROVIDER = "geliver"

/** The platform's code for Geliver's `code`; an unusable one is `rejected`. */
export function geliverErrorCode(code: unknown): string {
  return typeof code === "string" && /^[A-Za-z0-9_.-]{1,40}$/.test(code)
    ? `error_${code}`
    : typeof code === "number" && Number.isInteger(code)
      ? `error_${String(code)}`
      : "rejected"
}

/** A 4xx error body's code, for the HTTP client; a refused token keeps its status. */
export const geliverBodyCode = (body: unknown, status: number): string | undefined => {
  const code = (body as { code?: unknown } | null | undefined)?.code
  return status === 401 || status === 403 || code === undefined || code === null
    ? undefined
    : geliverErrorCode(code)
}

export const geliverError = (code: unknown) =>
  new ProviderError({
    provider: GELIVER_PROVIDER,
    providerCode: geliverErrorCode(code),
    retryable: false,
  })

/** The token is unknown or revoked: Geliver's 401 and 403. */
export const isTokenRefused = (providerCode: string): boolean =>
  providerCode === "http_401" || providerCode === "http_403"
