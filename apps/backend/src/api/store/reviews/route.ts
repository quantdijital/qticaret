import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../modules/product-reviews/service"
import type { StoreGetReviewsType } from "../products/[id]/reviews/validators"

/**
 * GET /store/reviews (F18 D10): the shop's approved reviews across its
 * products, newest first, each with its product's id and title, for the
 * storefront's reviews page. Only published products' reviews show.
 */
export async function GET(
  req: MedusaRequest<unknown, StoreGetReviewsType>,
  res: MedusaResponse
): Promise<void> {
  const { offset, limit } = req.validatedQuery
  const [rows, count] = await req.scope
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .listAndCountProductReviews(
      { status: "approved" },
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
  const ids = [...new Set(rows.map((row) => row.product_id))]
  const products = ids.length
    ? await req.scope
        .resolve(Modules.PRODUCT)
        .listProducts({ id: ids, status: "published" }, { select: ["id", "title"] })
    : []
  const titles = new Map(products.map((product) => [product.id, product.title]))
  res.json({
    reviews: rows.flatMap((row) => {
      const title = titles.get(row.product_id)
      return title === undefined
        ? []
        : [
            {
              id: row.id,
              product_id: row.product_id,
              product_title: title,
              rating: row.rating,
              title: row.title,
              body: row.body,
              author_name: row.author_name,
              created_at: row.created_at,
              verified_purchase: row.origin === "storefront",
            },
          ]
    }),
    count,
    offset,
    limit,
  })
}
