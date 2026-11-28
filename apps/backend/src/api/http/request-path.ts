import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  isAmbiguousTarget,
  routePathKeepingCaseOf,
  routePathOf,
  targetPath,
} from "@qticaret/server-kit"
import { rejectRequest } from "./reject"

// The path rules themselves are shared with the control plane (adr/0061, C3)
export { decodedSegment } from "@qticaret/server-kit"

/**
 * The full request path without the query. Medusa mounts a middleware that
 * lists no `methods` with `app.use`, and Express then strips the mount path
 * from `req.path` (under `"/*"` every path reads `/`); `originalUrl` keeps it.
 */
export function requestPath(req: MedusaRequest): string {
  return targetPath(requestTarget(req))
}

// Typed as strings, but absent on hand-built requests
function requestTarget(req: MedusaRequest): string {
  const fields = req as { originalUrl?: string; url?: string; path?: string }
  return fields.originalUrl ?? fields.url ?? fields.path ?? "/"
}

// A feed's address carries its token (F10.8), and so do the signed preview
// links: the logs keep the route, never the token
const TOKEN_PATHS: readonly [RegExp, string][] = [
  [/^\/feeds\/[^/]+/, "/feeds/:token"],
  [
    /^\/store\/storefront-layout\/(design|preview|session)\/[^/]+/,
    "/store/storefront-layout/$1/:token",
  ],
  [/^\/store\/content\/preview\/[^/]+/, "/store/content/preview/:token"],
  [/^\/store\/product-preview\/[^/]+/, "/store/product-preview/:token"],
]

/** The request path as logs keep it: a path that carries a secret has it masked. */
export const loggedPath = (path: string): string =>
  TOKEN_PATHS.reduce((kept, [pattern, mask]) => kept.replace(pattern, mask), path)

/**
 * The path as Express routes it, for deciding which rule applies: lower-cased,
 * without trailing slashes, the path of an absolute-form target
 * (`routePathOf` in @qticaret/server-kit).
 */
export function routePath(req: MedusaRequest): string {
  return routePathOf(requestPath(req))
}

/** `routePath` with the case kept, for reading IDs: `prod_01JABC` is not `prod_01jabc`. */
export function routePathKeepingCase(req: MedusaRequest): string {
  return routePathKeepingCaseOf(requestPath(req))
}

/** Refuses request targets Express and our path checks could read differently. */
export function rejectAmbiguousPath(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (isAmbiguousTarget(requestTarget(req))) {
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
