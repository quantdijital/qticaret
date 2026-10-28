import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { PRODUCT_REVIEWS_MODULE } from "../../../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../../../modules/product-reviews/service"
import { writeReview } from "../../../../../workflows/customers/reviews"
import type { StoreGetReviewsType, StorePostReviewType } from "./validators"

/**
 * GET /store/products/:id/reviews (F10.6, KK1): the approved reviews,
 * newest first, and the product's average; nothing waiting or rejected.
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
        select: ["id", "rating", "title", "body", "author_name", "created_at"],
      }
    ),
    reviews.ratingsOf([productId]),
  ])
  res.json({
    rating: ratings.get(productId) ?? null,
    reviews: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      body: row.body,
      author_name: row.author_name,
      created_at: row.created_at,
      // Only a customer who received the product writes one
      verified_purchase: true,
    })),
    count,
    offset,
    limit,
  })
}

/** POST /store/products/:id/reviews: a signed-in customer reviews a product they received. */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostReviewType>,
  res: MedusaResponse
): Promise<void> {
  const { rating, title, body } = req.validatedBody
  const { id } = await writeReview(req.scope, {
    customer_id: req.auth_context.actor_id,
    product_id: req.params["id"] ?? "",
    rating,
    title: title && title !== "" ? title : null,
    body,
  })
  res.status(201).json({ review: { id, status: "pending" } })
}
