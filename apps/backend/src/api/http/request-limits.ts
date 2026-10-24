import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectRequest } from "./reject"

/**
 * Bounds on what one request may ask for (docs/04, F2.10): Medusa has no
 * upper limit on `limit`, and its upload routes buffer files in memory.
 */

export const STORE_MAX_LIMIT = 100
// Above the per-file image limit (S5) times the files an admin sends at once
export const MAX_UPLOAD_REQUEST_BYTES = 25 * 1024 * 1024
// Digits only: Medusa reads `limit` with parseInt, so "1000abc" would be 1000
const LIMIT_VALUE = /^\d{1,3}$/

/** `/store/*`: a `limit` above 100, or one that is not a plain number, is refused. */
export function storeLimitGuard(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const value: unknown = req.query["limit"]
  if (value === undefined) {
    next()
    return
  }
  const problem =
    typeof value !== "string" || !LIMIT_VALUE.test(value)
      ? "invalid_limit"
      : Number(value) > STORE_MAX_LIMIT
        ? "limit_too_large"
        : null
  if (problem !== null) {
    rejectRequest(req, res, 400, { type: "invalid_data", message: `errors.${problem}` }, problem)
    return
  }
  next()
}

/**
 * Multipart requests (`/admin/uploads`, product imports): the declared size
 * is checked before multer starts buffering. A request without a length
 * (chunked) is refused too: its size is unknown until it is all in memory.
 * Judged by content type, not path: multer reads any multipart body on the
 * routes that use it, however the path is spelled.
 */
export function uploadSizeGate(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  // Global so it runs before the core routes' multer, which route
  // middlewares of ours would follow
  if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("multipart/")) {
    next()
    return
  }
  const declared = req.headers["content-length"]
  if (declared === undefined) {
    rejectRequest(
      req,
      res,
      411,
      { type: "invalid_data", message: "errors.length_required" },
      "upload_length_missing"
    )
    return
  }
  if (Number(declared) > MAX_UPLOAD_REQUEST_BYTES) {
    rejectRequest(
      req,
      res,
      413,
      { type: "invalid_data", message: "errors.request_too_large" },
      "upload_too_large"
    )
    return
  }
  next()
}
