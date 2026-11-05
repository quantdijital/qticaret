import type { MedusaContainer } from "@medusajs/framework/types"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import type { RatingDistribution } from "../../modules/product-reviews/service"

/** The shop's approved reviews in short: the average, how many, how many gave each number of stars. */
export interface ShopRating {
  average: number
  count: number
  distribution: RatingDistribution
}

const STARS = ["5", "4", "3", "2", "1"] as const

/**
 * The shop-wide rating from each product's counts per number of stars
 * (adr/0046 Ek 2026-11-05), over the products the shopper may see; the
 * average to one decimal, as a product's. Null without an approved review.
 */
export function shopRatingOf(
  rows: readonly { product_id: string; rating: number; count: number }[],
  visible: ReadonlySet<string>
): ShopRating | null {
  const distribution: RatingDistribution = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
  for (const row of rows) {
    const stars = String(row.rating)
    if (visible.has(row.product_id) && (STARS as readonly string[]).includes(stars)) {
      distribution[stars as keyof RatingDistribution] += row.count
    }
  }
  const count = STARS.reduce((sum, stars) => sum + distribution[stars], 0)
  if (count === 0) {
    return null
  }
  const total = STARS.reduce((sum, stars) => sum + Number(stars) * distribution[stars], 0)
  return { average: Math.round((total / count) * 10) / 10, count, distribution }
}

/** The shop-wide rating over the products the shopper may see; one grouped count. */
export async function shopRating(
  container: MedusaContainer,
  visible: ReadonlySet<string>
): Promise<ShopRating | null> {
  if (visible.size === 0) {
    return null
  }
  const rows = await container
    .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
    .approvedRatingCounts()
  return shopRatingOf(rows, visible)
}
