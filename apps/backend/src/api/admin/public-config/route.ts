import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { turnstilePublic } from "../../../lib/security/turnstile/public"

// The sign-in page reads it before anyone has signed in
export const AUTHENTICATE = false

/**
 * GET /admin/public-config (adr/0044 Ek 2026-11-24): what the panel's
 * sign-in and password reset pages need before a session: Turnstile's
 * public site key. Nothing else, nothing secret.
 */
export function GET(_req: MedusaRequest, res: MedusaResponse): void {
  res.setHeader("Cache-Control", "no-store")
  res.json({ turnstile: turnstilePublic() })
}
