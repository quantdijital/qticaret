import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { adminVideoView } from "../../../../../../workflows/media/video/read"
import { updateProductVideoWorkflow } from "../../../../../../workflows/media/video/edit"
import { removeProductVideoWorkflow } from "../../../../../../workflows/media/video/workflows"
import type { AdminUpdateProductVideoType } from "../validators"

/**
 * `POST /admin/products/:id/videos/:video_id` (adr/0069 §10): the video's
 * title; empty clears it (the product's name stands in). A video of
 * another product is a 404.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateProductVideoType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await updateProductVideoWorkflow(req.scope).run({
    input: {
      product_id: req.params["id"] ?? "",
      video_id: req.params["video_id"] ?? "",
      title: req.validatedBody.title,
    },
  })
  res.json({ video: adminVideoView(result) })
}

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
