import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../modules/product-reviews/service"
import { photosByReview } from "../../../workflows/customers/review-photo-reads"
import type { AdminGetReviewsType } from "./validators"

const PAGE = 20

/**
 * GET /admin/product-reviews (F10.6): reviews by state, the waiting ones
 * oldest first, each with the shop's reply; `replied=false`, only those
 * without one.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetReviewsType>,
  res: MedusaResponse
): Promise<void> {
  const { status, replied, offset } = req.validatedQuery
  const [rows, count] = await req.scope
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .listAndCountProductReviews(
      {
        status,
        ...(replied === undefined ? {} : { reply: replied === "true" ? { $ne: null } : null }),
      },
      { skip: offset, take: PAGE, order: { created_at: status === "pending" ? "ASC" : "DESC" } }
    )
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "title", "thumbnail"],
    filters: { id: [...new Set(rows.map((row) => row.product_id))] },
  })
  const products = new Map(
    (data as { id: string; title: string; thumbnail: string | null }[]).map((product) => [
      product.id,
      product,
    ])
  )
  // Staff judge the photos with the text: an approval shows both (adr/0037 §4 Ek 2026-11-04)
  const photos = await photosByReview(
    req.scope,
    rows.map((row) => row.id)
  )
  res.json({
    reviews: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      body: row.body,
      author_name: row.author_name,
      customer_id: row.customer_id,
      order_id: row.order_id,
      origin: row.origin,
      status: row.status,
      has_link: row.has_link,
      reject_reason: row.reject_reason,
      reply: row.reply,
      replied_at: row.replied_at,
      created_at: row.created_at,
      // The version staff see: moderation applies to it only
      updated_at: row.updated_at,
      product: products.get(row.product_id) ?? { id: row.product_id, title: null, thumbnail: null },
      photos: photos.get(row.id) ?? [],
    })),
    count,
    limit: PAGE,
  })
}
