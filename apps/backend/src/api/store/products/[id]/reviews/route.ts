import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { PRODUCT_REVIEWS_MODULE } from "../../../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../../../modules/product-reviews/service"
import { photosByReview } from "../../../../../workflows/customers/review-photo-reads"
import { writeReviewWorkflow } from "../../../../../workflows/customers/review-photos"
import type { StoreGetReviewsType, StorePostReviewType } from "./validators"

/**
 * GET /store/products/:id/reviews (F10.6, KK1): the approved reviews,
 * newest first, each with its photos, and the product's average with how
 * many reviews gave each number of stars (adr/0046 Ek 2026-11-04);
 * nothing waiting or rejected.
 */
export async function GET(
  req: MedusaRequest<unknown, StoreGetReviewsType>,
  res: MedusaResponse
): Promise<void> {
  const productId = req.params["id"] ?? ""
  const { offset, limit } = req.validatedQuery
  const reviews = req.scope.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
  const [[rows, count], ratings] = await Promise.all([
    reviews.listAndCountProductReviews(
      { product_id: productId, status: "approved" },
      {
        skip: offset,
        take: limit,
        order: { created_at: "DESC" },
        select: ["id", "rating", "title", "body", "author_name", "origin", "created_at"],
      }
    ),
    reviews.ratingsOf([productId]),
  ])
  const rating = ratings.get(productId) ?? null
  const [photos, distribution] = await Promise.all([
    photosByReview(
      req.scope,
      rows.map((row) => row.id)
    ),
    rating ? reviews.ratingDistribution(productId) : null,
  ])
  res.json({
    rating: rating ? { ...rating, distribution } : null,
    reviews: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      body: row.body,
      author_name: row.author_name,
      created_at: row.created_at,
      // Only a customer who received the product writes one here; one migrated was not checked here
      verified_purchase: row.origin === "storefront",
      photos: photos.get(row.id) ?? [],
    })),
    count,
    offset,
    limit,
  })
}

/**
 * POST /store/products/:id/reviews: a signed-in customer reviews a product
 * they received, with the photos they uploaded for it (`photo_ids`).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostReviewType>,
  res: MedusaResponse
): Promise<void> {
  const { rating, title, body, photo_ids } = req.validatedBody
  const { result } = await writeReviewWorkflow(req.scope).run({
    input: {
      customer_id: req.auth_context.actor_id,
      product_id: req.params["id"] ?? "",
      rating,
      title: title && title !== "" ? title : null,
      body,
      ...(photo_ids === undefined ? {} : { photo_ids }),
    },
  })
  res.status(201).json({ review: { id: result.id, status: "pending" } })
}
