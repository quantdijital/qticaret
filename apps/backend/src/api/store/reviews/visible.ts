import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createTtlCache } from "../../../lib/cache"
import { chunksOf } from "../../../lib/catalog"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import type ProductReviewsModuleService from "../../../modules/product-reviews/service"

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

async function readVisible(
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

/** Product id → title of the reviewed products the shopper's sales channels show. */
export const visibleReviewed = (
  scope: MedusaContainer,
  channelIds: readonly string[]
): Promise<Map<string, string>> =>
  visibleCache([...channelIds].sort().join(","), () => readVisible(scope, channelIds))
