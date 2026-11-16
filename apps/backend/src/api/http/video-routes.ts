import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { PRODUCT_VIDEOS } from "../../modules/platform-settings/features"
import { requireUserActor } from "./actor"
import { VIDEO_MAX_REQUEST_BYTES } from "../../lib/media/video/limits"
import { refuseAfterDrain } from "./drain-body"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"

const staffOf = (req: MedusaRequest) =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id

/**
 * An upload is a multipart form with its length declared (security review
 * O2): the size gate checks multipart bodies only, so any other type is
 * refused here (415) before anything reads it, and so is a body of
 * unknown length (411). Each answered once the body is drained (bounded at
 * the video path's 52 MB), so the client reads it (drain-body.ts).
 */
export function requireVideoForm(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const limits = { maxBytes: VIDEO_MAX_REQUEST_BYTES }
  if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("multipart/form-data")) {
    void refuseAfterDrain(
      req,
      res,
      415,
      { type: "invalid_data", message: "video.file_required" },
      "video_not_multipart",
      limits
    )
    return
  }
  if (req.headers["content-length"] === undefined) {
    void refuseAfterDrain(
      req,
      res,
      411,
      { type: "invalid_data", message: "errors.length_required" },
      "video_length_missing",
      limits
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
