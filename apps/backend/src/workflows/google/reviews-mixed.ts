import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createTtlCache } from "../../lib/cache"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import type { ReviewRow } from "../../modules/google-reviews/service"
import { REVIEW_FIELDS } from "../../modules/google-reviews/sync"
import { googleReviewsOf } from "./reviews"
import { shownGoogleLocation, storeGoogleReview } from "./reviews-read"

type Resolver = Pick<MedusaContainer, "resolve">

/** One review's place in the mixed list: its id and when it was written. */
export interface Dated {
  id: string
  at: Date | string
}

const time = (value: Date | string): number => new Date(value).getTime()

/**
 * Which reviews one page of the mixed list holds (adr/0058 Ek 2026-11-27):
 * the shop's and Google's, each already newest first, merged by date (the
 * shop's first on the same moment) and cut at `offset` for `limit`.
 */
export function mixedWindow(
  shop: readonly Dated[],
  google: readonly Dated[],
  offset: number,
  limit: number
): { shop: string[]; google: string[] } {
  const picked = { shop: [] as string[], google: [] as string[] }
  let s = 0
  let g = 0
  for (let index = 0; index < offset + limit; index += 1) {
    const nextShop = shop[s]
    const nextGoogle = google[g]
    if (nextShop && (!nextGoogle || time(nextShop.at) >= time(nextGoogle.at))) {
      if (index >= offset) {
        picked.shop.push(nextShop.id)
      }
      s += 1
    } else if (nextGoogle) {
      if (index >= offset) {
        picked.google.push(nextGoogle.id)
      }
      g += 1
    } else {
      break
    }
  }
  return picked
}

/**
 * Both lists' ids and dates, held 15 seconds per set of products (the
 * public page is the same for every shopper of the same sales channels):
 * a burst of requests reads them once.
 */
const datesCache = createTtlCache<{
  shopDates: Dated[]
  googleDates: Dated[]
  location: Awaited<ReturnType<typeof shownGoogleLocation>>
}>({ ttlMs: 15_000, maxEntries: 20 })

/**
 * One page of the shop's approved reviews of `productIds` mixed with its
 * Google reviews (adr/0058 Ek 2026-11-27): the shop's ids on the page (the
 * route reads them whole), the Google reviews on it as the Store API gives
 * them, and the count of both. Google's only while the storefront may show
 * them (a location picked, synced within Google's 30 days, not hidden).
 * Only ids and dates are read whole (held briefly); the page's rows alone in full.
 */
export async function mixedReviewsPage(
  container: Resolver,
  productIds: readonly string[],
  offset: number,
  limit: number,
  now = new Date()
) {
  const reviews = googleReviewsOf(container)
  const ids = [...productIds].sort()
  const key = createHash("sha256").update(ids.join(",")).digest("hex")
  const { shopDates, googleDates, location } = await datesCache(key, async () => {
    const [shop, shown] = await Promise.all([
      ids.length === 0
        ? Promise.resolve([])
        : container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE).listProductReviews(
            { status: "approved", product_id: ids },
            {
              select: ["id", "created_at"],
              order: { created_at: "DESC", id: "DESC" },
              take: null,
            }
          ),
      shownGoogleLocation(container, now),
    ])
    const google = shown
      ? await reviews.listGoogleReviews(
          { hidden: false },
          { select: ["id", "written_at"], order: { written_at: "DESC", id: "ASC" }, take: null }
        )
      : []
    return {
      shopDates: shop.map((row) => ({ id: row.id, at: row.created_at })),
      googleDates: google.map((row) => ({ id: row.id, at: row.written_at })),
      location: shown,
    }
  })
  const window = mixedWindow(shopDates, googleDates, offset, limit)
  const googleRows =
    location && window.google.length > 0
      ? ((await reviews.listGoogleReviews(
          // Hidden since the dates were read: left out
          { id: window.google, hidden: false },
          { select: [...REVIEW_FIELDS], take: null }
        )) as ReviewRow[])
      : []
  const byId = new Map(googleRows.map((row) => [row.id, row]))
  return {
    shopIds: window.shop,
    google: location
      ? window.google.flatMap((id) => {
          const row = byId.get(id)
          return row ? [storeGoogleReview(row, location)] : []
        })
      : [],
    count: shopDates.length + googleDates.length,
  }
}
