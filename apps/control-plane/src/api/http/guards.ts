import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { isAmbiguousTarget } from "@qticaret/server-kit"
import { isAllowedRoute } from "../../lib/route-allowlist"
import {
  applySecurityHeaders,
  ensureRequestId,
  rejectRequest,
  requestTarget,
  routePath,
} from "./request"

/** Every response carries a validated request ID and the security headers. */
export function requestBasics(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  ensureRequestId(req, res)
  applySecurityHeaders(res)
  next()
}

/**
 * Targets Express and our path checks could read differently (a dot
 * segment, a backslash, a fragment): refused before the allowlist reads them.
 */
export function rejectAmbiguousPath(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
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

/**
 * The route allowlist (adr/0061 §1.1), a global middleware: it runs before
 * Medusa's route middlewares (admin authentication, the publishable key)
 * and handlers, so a core route answers 404 as if it did not exist.
 */
export function routeAllowlist(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  if (!isAllowedRoute(routePath(req))) {
    rejectRequest(req, res, 404, { type: "not_found", message: "errors.not_found" }, "not_allowed")
    return
  }
  next()
}
