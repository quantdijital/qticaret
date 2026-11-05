import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../modules/product-reviews/service"
import { photosByReview } from "../../../workflows/customers/review-photo-reads"
import type { StoreGetShopReviewsType } from "../products/[id]/reviews/validators"
import { visibleReviewed } from "./visible"

/**
 * GET /store/reviews (F18 D10): the shop's approved reviews across its
 * products, newest first, each with its product's id and title and its
 * photos (adr/0037 §4 Ek 2026-11-04), for the storefront's reviews page.
 * Only products the shopper may see count: published, in the publishable
 * key's sales channels. With `rating` (1–5), only the reviews that gave
 * that many stars (adr/0037 Ek 2026-11-05), `count` theirs; the shop-wide
 * spread stays `/store/reviews/summary`'s.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetShopReviewsType>,
  res: MedusaResponse
): Promise<void> {
  const { offset, limit, rating } = req.validatedQuery
  const titles = await visibleReviewed(req.scope, req.publishable_key_context.sales_channel_ids)
  if (titles.size === 0) {
    res.json({ reviews: [], count: 0, offset, limit })
    return
  }
  const [rows, count] = await req.scope
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .listAndCountProductReviews(
      {
        status: "approved",
        product_id: [...titles.keys()],
        ...(rating === undefined ? {} : { rating }),
      },
      {
        skip: offset,
        take: limit,
        order: { created_at: "DESC" },
        select: [
          "id",
          "product_id",
          "rating",
          "title",
          "body",
          "author_name",
          "origin",
          "created_at",
        ],
      }
    )
  const photos = await photosByReview(
    req.scope,
    rows.map((row) => row.id)
  )
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
    })),
    count,
    offset,
    limit,
  })
}
