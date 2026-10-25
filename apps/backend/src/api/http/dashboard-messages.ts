import type { MedusaRequest } from "@medusajs/framework/http"
import { I18N_KEY } from "../../lib/errors"
import { serverErrorMessage } from "../../lib/errors/messages"
import type { ErrorBody } from "./error-response"
import { routePath } from "./request-path"

/**
 * A request from the admin dashboard in a browser. The dashboard
 * authenticates with the session cookie and never sends `Authorization`
 * (js-sdk session mode); the login form, before a session exists, is a
 * browser request with an `Origin`. API clients (integrations, scripts,
 * tests) send `Authorization` and keep getting keys.
 */
export function isDashboardRequest(req: MedusaRequest): boolean {
  // Typed as always there, but absent on hand-built requests
  const headers = (req.headers as MedusaRequest["headers"] | undefined) ?? {}
  if (headers.authorization !== undefined) {
    return false
  }
  const path = routePath(req)
  if (path.startsWith("/admin/")) {
    const session = (req as { session?: { auth_context?: unknown } }).session
    return session?.auth_context !== undefined && session.auth_context !== null
  }
  return path.startsWith("/auth/user/") && typeof headers.origin === "string"
}

/**
 * The error body as the dashboard shows it (adr/0021): its core screens
 * print `message` as it is, so our key becomes the Turkish sentence, and the
 * key stays in `code`. Other bodies and other clients are left alone.
 */
export function forDashboard(req: MedusaRequest, body: ErrorBody): ErrorBody {
  if (!I18N_KEY.test(body.message) || !isDashboardRequest(req)) {
    return body
  }
  return { ...body, code: body.message, message: serverErrorMessage(body.message, "tr") }
}
