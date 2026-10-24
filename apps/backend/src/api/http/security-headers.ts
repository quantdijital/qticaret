import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isLocalEnv, parseEnv } from "../../lib/env"

/**
 * Security headers on API responses (docs/04, F2.10). The API serves JSON
 * only, so the content policy allows nothing and no framing. Responses Medusa
 * writes before our middlewares run (the admin auth 401, CORS preflights,
 * the /app admin files) do not carry them; the reverse proxy adds them to
 * every response in F16.
 */
const HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
}

const HSTS = "max-age=31536000; includeSubDomains"

let isHstsEnabled: boolean | undefined

/** Sets the headers on a response that has not started; safe to call twice. */
export function applySecurityHeaders(res: MedusaResponse): void {
  if (res.headersSent) {
    return
  }
  for (const [name, value] of Object.entries(HEADERS)) {
    res.setHeader(name, value)
  }
  // HTTPS-only is promised outside local development, as the cookies are
  isHstsEnabled ??= !isLocalEnv(parseEnv())
  if (isHstsEnabled) {
    res.setHeader("Strict-Transport-Security", HSTS)
  }
  res.removeHeader("X-Powered-By")
}

export function securityHeaders(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  applySecurityHeaders(res)
  next()
}
