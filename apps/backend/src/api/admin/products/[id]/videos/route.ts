import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { VIDEOS_PER_PRODUCT, videoUploadAvailable } from "../../../../../lib/media/video"
import { adminVideoView, productVideos } from "../../../../../workflows/media/video/read"
import { uploadProductVideoWorkflow } from "../../../../../workflows/media/video/workflows"
import { AUDIT_RESOURCE_ID } from "../../../../http/audit/notes"
import { withCheckedVideo } from "../../../../http/video-upload"

/**
 * `GET /admin/products/:id/videos` (adr/0069): the product's videos, at most
 * two, and whether a clip can be uploaded on this machine (`upload`: only
 * on or off; why not is in the log, never the panel's).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const videos = await productVideos(req.scope, req.params["id"] ?? "")
  if (videos === null) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "products.unknown")
  }
  res.json({
    videos: videos.map(adminVideoView),
    limit: VIDEOS_PER_PRODUCT,
    upload: await videoUploadAvailable(),
  })
}

/**
 * `POST /admin/products/:id/videos` (adr/0069 §3): one clip as multipart
 * (`file`, optional `title`), checked before anything is stored
 * (`withCheckedVideo`), then stored private and recorded `uploaded` for the
 * transcoding job. 202: the video is not ready yet.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const productId = req.params["id"] ?? ""
  const video = await withCheckedVideo(req, productId, async (clip) => {
    const { result } = await uploadProductVideoWorkflow(req.scope).run({
      input: {
        product_id: productId,
        path: clip.path,
        bytes: clip.bytes,
        format: clip.format,
        width: clip.width,
        height: clip.height,
        duration_ms: clip.durationMs,
        title: clip.title,
        uploaded_by: req.auth_context.actor_type === "user" ? req.auth_context.actor_id : null,
      },
    })
    return result
  })
  res.locals[AUDIT_RESOURCE_ID] = video.id
  res.status(202).json({ video: adminVideoView(video) })
}
