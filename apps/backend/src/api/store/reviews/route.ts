import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../modules/product-reviews/service"
import { photosByReview } from "../../../workflows/customers/review-photo-reads"
import { mixedReviewsPage } from "../../../workflows/google/reviews-mixed"
import type { StoreGetShopReviewsType } from "../products/[id]/reviews/validators"
import { storeRepliesOf } from "./reply"
import { visibleReviewed } from "./visible"

const FIELDS = [
  "id",
  "product_id",
  "rating",
  "title",
  "body",
  "author_name",
  "origin",
  "created_at",
  "reply",
  "replied_at",
]

/**
 * GET /store/reviews (F18 D10): the shop's approved reviews across its
 * products, newest first, each with its product's id and title, its
 * photos (adr/0037 §4 Ek 2026-11-04) and the shop's reply, for the
 * storefront's reviews page.
 * Only products the shopper may see count: published, in the publishable
 * key's sales channels. With `rating` (1–5), only the reviews that gave
 * that many stars (adr/0037 Ek 2026-11-05), `count` theirs; the shop-wide
 * spread stays `/store/reviews/summary`'s. With `google=1` (and no
 * `rating`), the page is cut from the shop's and its Google reviews mixed
 * by date (adr/0058 Ek 2026-11-27): the shop's under `reviews`, Google's
 * under `google_reviews`, `count` both; Google's average stays apart.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetShopReviewsType>,
  res: MedusaResponse
): Promise<void> {
  const { offset, limit, rating, google } = req.validatedQuery
  const mixed = google === "1" && rating === undefined
  const titles = await visibleReviewed(req.scope, req.publishable_key_context.sales_channel_ids)
  if (titles.size === 0 && !mixed) {
    res.json({ reviews: [], count: 0, offset, limit })
    return
  }
  const service = req.scope.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
  let rows: Awaited<ReturnType<typeof service.listProductReviews>>
  let count: number
  let fromGoogle: Awaited<ReturnType<typeof mixedReviewsPage>>["google"] | null = null
  if (mixed) {
    const page = await mixedReviewsPage(req.scope, [...titles.keys()], offset, limit)
    rows =
      page.shopIds.length === 0
        ? []
        : await service.listProductReviews(
            { id: page.shopIds },
            { select: FIELDS, order: { created_at: "DESC", id: "DESC" }, take: null }
          )
    count = page.count
    fromGoogle = page.google
  } else {
    ;[rows, count] = await service.listAndCountProductReviews(
      {
        status: "approved",
        product_id: [...titles.keys()],
        ...(rating === undefined ? {} : { rating }),
      },
      { skip: offset, take: limit, order: { created_at: "DESC" }, select: FIELDS }
    )
  }
  const [photos, replyOf] = await Promise.all([
    photosByReview(
      req.scope,
      rows.map((row) => row.id)
    ),
    storeRepliesOf(req.scope, rows),
  ])
  res.json({
    reviews: rows.map((row) => ({
      id: row.id,
      product_id: row.product_id,
      product_title: titles.get(row.product_id) ?? "",
      rating: row.rating,
      title: row.title,
      body: row.body,
      author_name: row.author_name,
      created_at: row.created_at,
      verified_purchase: row.origin === "storefront",
      photos: photos.get(row.id) ?? [],
      reply: replyOf(row),
    })),
    ...(fromGoogle ? { google_reviews: fromGoogle } : {}),
    count,
    offset,
    limit,
  })
}
