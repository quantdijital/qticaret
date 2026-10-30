import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseEnv } from "../../lib/env"
import { rejectRequest } from "./reject"
import { routePath } from "./request-path"

/**
 * CSRF protection for cookie sessions (adr/0004, F2.10). Medusa has none;
 * `sameSite: lax` stops most cross-site posts but not every browser path.
 * A mutation that carries the session cookie must come from an origin in
 * the area's CORS allow list. Bearer and API key requests carry no ambient
 * credential, so they are not checked.
 *
 * - `/store/*` needs no extra header: Medusa already requires
 *   `x-publishable-api-key`, which a cross-site form cannot send.
 * - `/admin/*` bodies must be JSON (a form cannot send that cross-site),
 *   except multipart file uploads, which rely on
 *   the origin check alone, and the product sheet upload, whose xlsx or
 *   CSV body types no form can send either (they are not CORS-simple).
 * - Any other path (none sets the cookie today) needs an origin from any of
 *   the three lists: a path the areas miss must not miss the check.
 *
 * Areas are judged by the path as Express routes it (`routePath`):
 * `/ADMIN/invites` reaches the admin route and must meet the admin rules.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
// Medusa's default session cookie name (sessionOptions.name is not set)
const SESSION_COOKIE = "connect.sid"
// Admin routes that take files as multipart: uploads (Medusa's product import is closed, F3.9)
const MULTIPART_PATH = /^\/admin\/uploads(\/|$)/
// The product sheet upload (F3.9): its bytes as the body, typed as what they are
const SHEET_PATH = /^\/admin\/catalog\/imports$/
const SHEET_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/octet-stream",
]

// A migration's customer list (F14.3): a sheet as the product import takes one
const CUSTOMER_SHEET_PATH = /^\/admin\/migrations\/customers$/

// Search Console's export of the old site's top pages (F14.7): a zip or its pages CSV
const SEARCH_CONSOLE_PATH = /^\/admin\/migrations\/urls\/search-console$/
const SEARCH_CONSOLE_TYPES = ["text/csv", "application/zip", "application/octet-stream"]

// An invoice issued elsewhere (F8, adr/0034 §9): its PDF as the body, on its own path only
const INVOICE_PDF_PATH = /^\/admin\/invoices\/[^/]+\/pdf$/

type Area = "store" | "admin" | "auth"

const areaOf = (path: string): Area | null => {
  const [, first] = path.split("/")
  return first === "store" || first === "admin" || first === "auth" ? first : null
}

const hasSessionCookie = (req: MedusaRequest): boolean =>
  (req.headers.cookie ?? "").split(";").some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`))

function originOf(value: string | undefined): string | null {
  if (value === undefined || value === "null" || !URL.canParse(value)) {
    return null
  }
  return new URL(value).origin
}

// An Origin header, "null" included, is the browser's own answer; the
// Referer stands in only when there is no Origin at all (adr/0004). A
// redirect or a sandboxed frame sends "null" with a Referer from elsewhere.
const requestOrigin = (req: MedusaRequest): string | null =>
  req.headers.origin === undefined ? originOf(req.headers.referer) : originOf(req.headers.origin)

let allowLists: Record<Area, Set<string>> | undefined

function allowList(area: Area | null): Set<string> {
  allowLists ??= (() => {
    const env = parseEnv()
    const parse = (list: string) =>
      new Set(list.split(",").map((origin) => new URL(origin.trim()).origin))
    return {
      store: parse(env.STORE_CORS),
      admin: parse(env.ADMIN_CORS),
      auth: parse(env.AUTH_CORS),
    }
  })()
  return area === null
    ? new Set([...allowLists.store, ...allowLists.admin, ...allowLists.auth])
    : allowLists[area]
}

const hasBody = (req: MedusaRequest): boolean =>
  Number(req.headers["content-length"] ?? 0) > 0 || req.headers["transfer-encoding"] !== undefined

function isAllowedAdminBody(req: MedusaRequest): boolean {
  const type = (req.headers["content-type"] ?? "").toLowerCase()
  return (
    !hasBody(req) ||
    type.startsWith("application/json") ||
    (type.startsWith("multipart/form-data") && MULTIPART_PATH.test(routePath(req))) ||
    (SHEET_TYPES.some((sheet) => type.startsWith(sheet)) &&
      (SHEET_PATH.test(routePath(req)) || CUSTOMER_SHEET_PATH.test(routePath(req)))) ||
    (SEARCH_CONSOLE_TYPES.some((file) => type.startsWith(file)) &&
      SEARCH_CONSOLE_PATH.test(routePath(req))) ||
    (type.startsWith("application/pdf") && INVOICE_PDF_PATH.test(routePath(req)))
  )
}

export function csrfProtection(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (SAFE_METHODS.has(req.method) || !hasSessionCookie(req)) {
    next()
    return
  }
  const area = areaOf(routePath(req))
  const origin = requestOrigin(req)
  if (origin === null || !allowList(area).has(origin)) {
    rejectRequest(
      req,
      res,
      403,
      { type: "not_allowed", message: "errors.csrf_rejected" },
      "csrf_origin"
    )
    return
  }
  if (area === "admin" && !isAllowedAdminBody(req)) {
    rejectRequest(
      req,
      res,
      403,
      { type: "not_allowed", message: "errors.csrf_rejected" },
      "csrf_content_type"
    )
    return
  }
  next()
}
