import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { VIDEO_MAX_REQUEST_BYTES } from "../../lib/media/video/limits"
import { rejectRequest } from "./reject"
import { routePath } from "./request-path"

/**
 * Bounds on what one request may ask for (docs/04, F2.10): Medusa has no
 * upper limit on `limit`, and its upload routes buffer files in memory.
 */

export const STORE_MAX_LIMIT = 100
// The dashboard loads whole lookup lists with 9999: regions and price
// preferences on product create and price editing, stock locations,
// categories, price lists (v2.21.2 source). 1000 broke product create;
// the bound stays against unpaged reads of millions
export const ADMIN_MAX_LIMIT = 9999
// Above the per-file image limit (S5) times the files an admin sends at once
export const MAX_UPLOAD_REQUEST_BYTES = 25 * 1024 * 1024
// Digits only: Medusa reads `limit` with parseInt, so "1000abc" would be 1000
const LIMIT_VALUE = /^\d{1,5}$/

function limitGuard(max: number) {
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const value: unknown = req.query["limit"]
    if (value === undefined) {
      next()
      return
    }
    const problem =
      typeof value !== "string" || !LIMIT_VALUE.test(value)
        ? "invalid_limit"
        : Number(value) > max
          ? "limit_too_large"
          : null
    if (problem !== null) {
      rejectRequest(req, res, 400, { type: "invalid_data", message: `errors.${problem}` }, problem)
      return
    }
    next()
  }
}

/** `/store/*`: a `limit` above 100, or one that is not a plain number, is refused. */
export const storeLimitGuard = limitGuard(STORE_MAX_LIMIT)

/** `/admin/*`: a `limit` above what the dashboard asks for is refused (bulk reads, adr/0011). */
export const adminLimitGuard = limitGuard(ADMIN_MAX_LIMIT)

// A product video's upload (adr/0069 §3): streamed to disk, never into multer's memory
const VIDEO_UPLOAD_PATH = /^\/admin\/products\/[^/]+\/videos$/

/** Whether the request is a product video's upload, by the path Express routes. */
export const isVideoUpload = (req: MedusaRequest): boolean =>
  req.method === "POST" && VIDEO_UPLOAD_PATH.test(routePath(req))

/**
 * Multipart requests (`/admin/uploads`, product imports): the declared size
 * is checked before multer starts buffering. A request without a length
 * (chunked) is refused too: its size is unknown until it is all in memory.
 * Judged by content type, not path: multer reads any multipart body on the
 * routes that use it, however the path is spelled. A product video's
 * upload alone has a limit of its own (52 MB: 50 MB of clip and the
 * framing); its route streams the body to disk and counts it again.
 */
export function uploadSizeGate(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  // Global so it runs before the core routes' multer, which route
  // middlewares of ours would follow
  if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("multipart/")) {
    next()
    return
  }
  const video = isVideoUpload(req)
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
  if (Number(declared) > (video ? VIDEO_MAX_REQUEST_BYTES : MAX_UPLOAD_REQUEST_BYTES)) {
    rejectRequest(
      req,
      res,
      413,
      { type: "invalid_data", message: video ? "video.too_large" : "errors.request_too_large" },
      "upload_too_large"
    )
    return
  }
  next()
}
