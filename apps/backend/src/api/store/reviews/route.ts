import type { MedusaContainer } from "@medusajs/framework/types"
import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTtlCache } from "../../../lib/cache"
import { chunksOf } from "../../../lib/catalog"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../modules/product-reviews/service"
import type { StoreGetReviewsType } from "../products/[id]/reviews/validators"

interface ProductRow {
  id: string
  title: string
  sales_channels?: ({ id: string } | null)[] | null
}

/**
 * The reviewed products a shopper may see, with their titles: published
 * and in one of the shopper's sales channels (security review 2026-11-02).
 * Held 30 seconds per set of channels: the page is the same for everyone.
 */
const visibleCache = createTtlCache<Map<string, string>>({ ttlMs: 30_000, maxEntries: 20 })

async function visibleReviewed(
  scope: MedusaContainer,
  channelIds: readonly string[]
): Promise<Map<string, string>> {
  const rows = await scope
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .listProductReviews({ status: "approved" }, { select: ["product_id"], take: null })
  const ids = [...new Set(rows.map((row) => row.product_id))]
  const channels = new Set(channelIds)
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const visible = new Map<string, string>()
  for (const chunk of chunksOf(ids)) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "sales_channels.id"],
      filters: { id: chunk, status: "published" },
    })
    for (const product of data as ProductRow[]) {
      if ((product.sales_channels ?? []).some((each) => each && channels.has(each.id))) {
        visible.set(product.id, product.title)
      }
    }
  }
  return visible
}

/**
 * GET /store/reviews (F18 D10): the shop's approved reviews across its
 * products, newest first, each with its product's id and title, for the
 * storefront's reviews page. Only products the shopper may see count:
 * published, in the publishable key's sales channels.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetReviewsType>,
  res: MedusaResponse
): Promise<void> {
  const { offset, limit } = req.validatedQuery
  const channelIds = req.publishable_key_context.sales_channel_ids
  const titles = await visibleCache([...channelIds].sort().join(","), () =>
    visibleReviewed(req.scope, channelIds)
  )
  if (titles.size === 0) {
    res.json({ reviews: [], count: 0, offset, limit })
    return
  }
  const [rows, count] = await req.scope
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .listAndCountProductReviews(
      { status: "approved", product_id: [...titles.keys()] },
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
    })),
    count,
    offset,
    limit,
  })
}
