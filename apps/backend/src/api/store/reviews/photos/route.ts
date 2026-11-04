import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { latestReviewPhotos } from "../../../../workflows/customers/review-photo-reads"
import type { StoreGetReviewPhotosType } from "../../products/[id]/reviews/validators"
import { visibleReviewed } from "../visible"

/**
 * GET /store/reviews/photos?limit= (adr/0046 Ek 2026-11-04): the newest
 * photos customers put on their approved reviews, across the products the
 * shopper may see, each with its review's stars and author and its
 * product, for the home page's "customer photos". The same for everyone.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetReviewPhotosType>,
  res: MedusaResponse
): Promise<void> {
  const titles = await visibleReviewed(req.scope, req.publishable_key_context.sales_channel_ids)
  const photos = await latestReviewPhotos(req.scope, titles, req.validatedQuery.limit)
  res.setHeader("Cache-Control", "public, max-age=60")
  res.vary("x-publishable-api-key")
  res.json({ photos })
}
