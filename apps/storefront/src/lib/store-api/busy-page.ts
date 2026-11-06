import { t } from "../i18n"

/**
 * The proxy's answer to a page view while the backend's rate limit holds
 * the visitor back (`busy.ts`): 503 with the backend's `Retry-After`, never
 * stored, a line of text. No `noindex`: a 503 tells a search engine to come
 * back and keep the page. A HEAD gets the headers only.
 */
export function rateLimitedResponse(waitSeconds: number, head = false): Response {
  return new Response(head ? null : t("errors.too_many_requests"), {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": String(waitSeconds),
      "x-content-type-options": "nosniff",
    },
  })
}
