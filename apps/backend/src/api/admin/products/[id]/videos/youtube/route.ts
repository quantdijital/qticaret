import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../../../lib/errors"
import { VIDEOS_PER_PRODUCT } from "../../../../../../lib/media/video/limits"
import { titleFromYoutube, youtubeIdOf } from "../../../../../../lib/media/video/youtube"
import { assertStorageFits } from "../../../../../../lib/plan-limits"
import { adminVideoView, productVideos } from "../../../../../../workflows/media/video/read"
import { addYoutubeVideoWorkflow } from "../../../../../../workflows/media/video/youtube"
import { checkYoutubeVideo } from "../../../../../../workflows/media/video/youtube-fetch"
import { AUDIT_RESOURCE_ID } from "../../../../../http/audit/notes"
import type { AdminAddYoutubeVideoType } from "../validators"

/** Before YouTube is asked: the product, its room for a video, storage not full already. */
async function precheck(container: MedusaContainer, productId: string): Promise<void> {
  const videos = await productVideos(container, productId)
  if (videos === null) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "products.unknown")
  }
  if (videos.length >= VIDEOS_PER_PRODUCT) {
    throw new ValidationError("video.limit_per_product", { field: "url" })
  }
  await assertStorageFits(container, 0)
}

/**
 * `POST /admin/products/:id/videos/youtube` (adr/0069 §8) `{ url, title? }`:
 * the video's id taken from the link (nothing else of it is kept), the
 * video checked with YouTube (oEmbed: embeddable and public), its cover
 * copied to our storage, the record opened `ready`. 201 with the video.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminAddYoutubeVideoType>,
  res: MedusaResponse
): Promise<void> {
  const productId = req.params["id"] ?? ""
  const youtubeId = youtubeIdOf(req.validatedBody.url)
  if (youtubeId === null) {
    throw new ValidationError("video.youtube_invalid", { field: "url" })
  }
  await precheck(req.scope, productId)
  const found = await checkYoutubeVideo(youtubeId)
  const { result } = await addYoutubeVideoWorkflow(req.scope).run({
    input: {
      product_id: productId,
      youtube_id: youtubeId,
      // The shop's own title first; YouTube's fills an empty one only
      title: req.validatedBody.title ?? titleFromYoutube(found.title),
      uploaded_by: req.auth_context.actor_type === "user" ? req.auth_context.actor_id : null,
    },
  })
  res.locals[AUDIT_RESOURCE_ID] = result.id
  res.status(201).json({ video: adminVideoView(result) })
}
