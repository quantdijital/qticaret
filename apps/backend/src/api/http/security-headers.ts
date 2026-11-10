import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { HSTS_HEADER, SECURITY_HEADERS } from "@qticaret/server-kit"
import { isLocalEnv, parseEnv } from "../../lib/env"

/**
 * Security headers on API responses (docs/04, F2.10; the set is shared with
 * the control plane in @qticaret/server-kit). Responses Medusa
 * writes before our middlewares run (the admin auth 401, CORS preflights,
 * the /app admin files) do not carry them; the reverse proxy adds them to
 * every response in F16.
 */
let isHstsEnabled: boolean | undefined

/** Sets the headers on a response that has not started; safe to call twice. */
export function applySecurityHeaders(res: MedusaResponse): void {
  if (res.headersSent) {
    return
  }
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value)
  }
  // HTTPS-only is promised outside local development, as the cookies are
  isHstsEnabled ??= !isLocalEnv(parseEnv())
  if (isHstsEnabled) {
    res.setHeader("Strict-Transport-Security", HSTS_HEADER)
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
