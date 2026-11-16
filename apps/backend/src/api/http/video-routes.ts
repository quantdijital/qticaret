import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { PRODUCT_VIDEOS } from "../../modules/platform-settings/features"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { rejectRequest } from "./reject"
import { requireFeature } from "./require-feature"

const staffOf = (req: MedusaRequest) =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id

/**
 * An upload is a multipart form with its length declared (security review
 * O2): the size gate checks multipart bodies only, so any other type is
 * refused here (415) before anything reads it, and so is a body of
 * unknown length (411).
 */
export function requireVideoForm(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("multipart/form-data")) {
    rejectRequest(
      req,
      res,
      415,
      { type: "invalid_data", message: "video.file_required" },
      "video_not_multipart"
    )
    return
  }
  if (req.headers["content-length"] === undefined) {
    rejectRequest(
      req,
      res,
      411,
      { type: "invalid_data", message: "errors.length_required" },
      "video_length_missing"
    )
    return
  }
  next()
}

/**
 * A product's videos (adr/0069), behind `catalog.product_videos` (first: off,
 * the routes do not exist). Under `/admin/products*`, so the plan guard
 * (closed in a restricted shop) and the product write role apply as for
 * images. An upload is a person's (it records who), reads its own body
 * (no parser: streamed to disk, lib/media/video/receive.ts) and has a
 * budget of its own per address and per staff member.
 */
export const VIDEO_ROUTES = [
  {
    matcher: "/admin/products/:id/videos",
    methods: ["GET" as const],
    middlewares: [requireFeature(PRODUCT_VIDEOS)],
  },
  {
    matcher: "/admin/products/:id/videos",
    methods: ["POST" as const],
    bodyParser: false as const,
    middlewares: [
      requireFeature(PRODUCT_VIDEOS),
      requireVideoForm,
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.media_video, { identity: staffOf }),
    ],
  },
  {
    matcher: "/admin/products/:id/videos/:video_id",
    methods: ["DELETE" as const],
    middlewares: [requireFeature(PRODUCT_VIDEOS)],
  },
]
