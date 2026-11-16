import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { removeProductVideoWorkflow } from "../../../../../../workflows/media/video/workflows"

/**
 * `DELETE /admin/products/:id/videos/:video_id` (adr/0069 §11): the video
 * comes off the product and its files go at once; storage refusing, the
 * nightly sweep removes them.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const videoId = req.params["video_id"] ?? ""
  await removeProductVideoWorkflow(req.scope).run({
    input: { product_id: req.params["id"] ?? "", video_id: videoId },
  })
  res.json({ id: videoId, object: "media_video", deleted: true })
}
