import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectRequest } from "./reject"

/**
 * The full request path without the query. Medusa mounts a middleware that
 * lists no `methods` with `app.use`, and Express then strips the mount path
 * from `req.path` (under `"/*"` every path reads `/`); `originalUrl` keeps it.
 */
export function requestPath(req: MedusaRequest): string {
  // Typed as strings, but absent on hand-built requests
  const fields = req as { originalUrl?: string; url?: string; path?: string }
  const url = fields.originalUrl ?? fields.url ?? fields.path ?? "/"
  const end = url.indexOf("?")
  return end === -1 ? url : url.slice(0, end)
}

// `POST http://host/path HTTP/1.1` is a valid request line; Express routes its path
const ABSOLUTE_FORM = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i

/**
 * The path as Express routes it, for deciding which rule applies. Express
 * matches without regard to case or a trailing slash, and takes the path of
 * an absolute-form target; judged by the raw path, `/AUTH/customer/emailpass/`
 * would reach the login route and dodge the login limit. Percent escapes
 * stay as they are: Express does not decode fixed segments either.
 */
export function routePath(req: MedusaRequest): string {
  return routePathKeepingCase(req).toLowerCase()
}

/** `routePath` with the case kept, for reading IDs: `prod_01JABC` is not `prod_01jabc`. */
export function routePathKeepingCase(req: MedusaRequest): string {
  const raw = requestPath(req)
  const end = raw.indexOf("#")
  const path = (end === -1 ? raw : raw.slice(0, end)).replace(ABSOLUTE_FORM, "")
  return path.replace(/\/+$/, "") || "/"
}

// A backslash or a fragment in the request line: no client sends one, and
// when `#` is present Express's URL parser turns `\` into `/`, so the route
// Express picks and the path our checks read would differ
const AMBIGUOUS_TARGET = /[\\#]/

/** Refuses request targets Express and our path checks could read differently. */
export function rejectAmbiguousPath(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const fields = req as { originalUrl?: string; url?: string }
  if (AMBIGUOUS_TARGET.test(fields.originalUrl ?? fields.url ?? "")) {
    rejectRequest(
      req,
      res,
      400,
      { type: "invalid_data", message: "errors.invalid_request" },
      "ambiguous_path"
    )
    return
  }
  next()
}
