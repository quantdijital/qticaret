import type { MedusaRequest } from "@medusajs/framework/http"
import { I18N_KEY, PROVIDER_FAILED_MESSAGE } from "../../lib/errors"
import { PLAN_LIMIT_MESSAGE } from "../../lib/errors/plan-limit"
import { PLAN_RESTRICTED_MESSAGE } from "../../lib/plan-guard/decide"
import {
  planLimitSentence,
  planRestrictedSentence,
  providerFailureSentence,
  serverErrorMessage,
} from "../../lib/errors/messages"
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
 * print `message` as it is, so our key becomes the Turkish sentence, with
 * what the error named (`values`) in it, and the key stays in `code`.
 * Other bodies and other clients are left alone.
 */
export function forDashboard(req: MedusaRequest, body: ErrorBody): ErrorBody {
  if (!I18N_KEY.test(body.message) || !isDashboardRequest(req)) {
    return body
  }
  return { ...body, code: body.message, message: dashboardSentence(body) }
}

// A provider's failure names the service and quotes it: the session client
// keeps nothing of a refusal but this sentence
function dashboardSentence(body: ErrorBody): string {
  if (body.message === PROVIDER_FAILED_MESSAGE && body.provider) {
    return providerFailureSentence(
      {
        provider: body.provider,
        provider_message: body.provider_message,
        retryable: body.type === "provider_unavailable",
      },
      "tr"
    )
  }
  // A plan limit names which one, how much is used and allowed (adr/0061 Ek C14)
  if (body.message === PLAN_LIMIT_MESSAGE) {
    return planLimitSentence(body, "tr")
  }
  // A write the shop's status closes: why, and where to look (adr/0061 Ek C15)
  if (body.message === PLAN_RESTRICTED_MESSAGE) {
    return planRestrictedSentence(body.status, "tr")
  }
  return serverErrorMessage(body.message, "tr", body.values)
}
