import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseEnv } from "../../lib/env"
import { SESSION_COOKIE } from "../../lib/session-cookie"
import { rejectRequest, routePath } from "./request"

/**
 * CSRF protection for cookie sessions (the shop's api/http/csrf.ts, the
 * control plane's areas only; Ek C4, L5). `sameSite: strict` already keeps
 * the cookie off cross-site requests; this is the second wall. A mutation
 * that carries the session cookie must come from an origin in its area's
 * CORS list (`/admin` ADMIN_CORS, `/auth` AUTH_CORS), and an `/admin` body
 * must be JSON (a cross-site form cannot send that). Bearer requests carry
 * no ambient credential and are not checked.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const hasSessionCookie = (req: MedusaRequest): boolean =>
  (req.headers.cookie ?? "").split(";").some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`))

function originOf(value: string | undefined): string | null {
  if (value === undefined || value === "null" || !URL.canParse(value)) {
    return null
  }
  return new URL(value).origin
}

// An Origin header, "null" included, is the browser's own answer; the
// Referer stands in only when there is no Origin at all
const requestOrigin = (req: MedusaRequest): string | null =>
  req.headers.origin === undefined ? originOf(req.headers.referer) : originOf(req.headers.origin)

let allowLists: { admin: Set<string>; auth: Set<string> } | undefined

function allowList(path: string): Set<string> {
  allowLists ??= (() => {
    const env = parseEnv()
    const parse = (list: string) =>
      new Set(list.split(",").map((origin) => new URL(origin.trim()).origin))
    return { admin: parse(env.ADMIN_CORS), auth: parse(env.AUTH_CORS) }
  })()
  if (path.startsWith("/admin/")) {
    return allowLists.admin
  }
  // `/auth` and any other path a cookie reaches (none today): either list
  return path.startsWith("/auth/")
    ? allowLists.auth
    : new Set([...allowLists.admin, ...allowLists.auth])
}

const hasBody = (req: MedusaRequest): boolean =>
  Number(req.headers["content-length"] ?? 0) > 0 || req.headers["transfer-encoding"] !== undefined

export function csrfProtection(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (SAFE_METHODS.has(req.method) || !hasSessionCookie(req)) {
    next()
    return
  }
  const path = routePath(req)
  const origin = requestOrigin(req)
  const rejected = { type: "not_allowed", message: "errors.csrf_rejected" }
  if (origin === null || !allowList(path).has(origin)) {
    rejectRequest(req, res, 403, rejected, "csrf_origin")
    return
  }
  const type = (req.headers["content-type"] ?? "").toLowerCase()
  if (path.startsWith("/admin/") && hasBody(req) && !type.startsWith("application/json")) {
    rejectRequest(req, res, 403, rejected, "csrf_content_type")
    return
  }
  next()
}
