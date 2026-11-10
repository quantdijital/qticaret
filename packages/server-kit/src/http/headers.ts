/**
 * Security headers on API responses (docs/04, F2.10). The APIs serve JSON
 * only, so the content policy allows nothing and no framing. HSTS is sent
 * outside local development only (`isLocalEnv`), as cookies are Secure there.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}

export const HSTS_HEADER = "max-age=31536000; includeSubDomains"

// UUIDs and the usual proxy and tracing formats. Medusa copies the incoming
// `x-request-id` unchecked; anything else is replaced so a caller cannot put
// arbitrary text into logs and responses.
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

export const REQUEST_ID_HEADER = "X-Request-Id"

export const isValidRequestId = (value: unknown): value is string =>
  typeof value === "string" && REQUEST_ID.test(value)
