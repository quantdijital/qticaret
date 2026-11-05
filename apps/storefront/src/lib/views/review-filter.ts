import type { ReviewFilterView, ReviewStars, ShopRatingView, Translate } from "@qticaret/ui"

/**
 * The reviews page's star filter (adr/0037 Ek 2026-11-05): `?puan=5` shows
 * the reviews that gave five stars alone, one number at a time (the
 * backend's `GET /store/reviews?rating=`). The links come from the
 * shop-wide spread, so their counts never shrink to the page shown.
 */

export const REVIEWS_PATH = "/yorumlar"

type Query = Record<string, string | string[] | undefined>

/** The stars `?puan=` asks for: none when absent, null when it is no number of stars. */
export function starsOf(query: Query): ReviewStars | undefined | null {
  const raw = query["puan"]
  if (raw === undefined) {
    return undefined
  }
  return typeof raw === "string" && /^[1-5]$/.test(raw) ? (Number(raw) as ReviewStars) : null
}

/** The page's address: the filter first, then the page number past the first. */
export function reviewsPath(page: number, stars: ReviewStars | null = null): string {
  const query = [
    ...(stars === null ? [] : [`puan=${String(stars)}`]),
    ...(page > 1 ? [`sayfa=${String(page)}`] : []),
  ]
  return query.length > 0 ? `${REVIEWS_PATH}?${query.join("&")}` : REVIEWS_PATH
}

/**
 * A link per number of stars, 5 to 1, from the shop-wide spread; a number
 * no review gave is no link. None without the spread (an older backend,
 * no approved review): the page then shows every review, unfiltered.
 */
export function reviewFilterView(
  summary: ShopRatingView | null,
  active: ReviewStars | null,
  t: Translate
): ReviewFilterView | null {
  if (!summary || summary.distribution.length === 0) {
    return null
  }
  return {
    options: summary.distribution.map((bar) => ({
      stars: bar.stars,
      count: bar.count,
      path: bar.count > 0 ? reviewsPath(1, bar.stars) : null,
      label: t("reviews.filter_option", { stars: bar.stars, count: bar.count }),
      active: bar.stars === active,
    })),
    active,
    activeLabel: active === null ? null : t("reviews.bar_stars", { stars: active }),
    clearPath: REVIEWS_PATH,
  }
}
