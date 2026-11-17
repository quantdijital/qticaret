import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { retryProductVideoWorkflow } from "../../../../../../../workflows/media/video/edit"
import { adminVideoView, productVideos } from "../../../../../../../workflows/media/video/read"

/**
 * `POST /admin/products/:id/videos/:video_id/retry` (adr/0069 §10,
 * "Yeniden dene"): a clip the infrastructure failed waits for the job
 * again, while its source is kept. 409 otherwise (`video.source_gone`,
 * `video.retry_unavailable`); a video of another product is a 404.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const productId = req.params["id"] ?? ""
  const videoId = req.params["video_id"] ?? ""
  await retryProductVideoWorkflow(req.scope).run({
    input: { product_id: productId, video_id: videoId },
  })
  const video = (await productVideos(req.scope, productId))?.find((each) => each.id === videoId)
  if (!video) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "video.unknown")
  }
  res.status(202).json({ video: adminVideoView(video) })
}
