import type { GoogleRatingExcerptView, GoogleRatingSectionView, Translate } from "@qticaret/ui"
import type { StoreGoogleRatingSection, StoreGoogleReviews } from "@qticaret/types"

/**
 * The home page's Google rating badge (adr/0058 Ek 2026-11-06) as a theme
 * draws it, from the section's options and the Store answer: Google's own
 * average (one decimal) and count, never one worked out here; a link to
 * `/yorumlar`; Google Maps only over https and when the shop wants it;
 * excerpts only of four and five stars with text, none the shop hid (the
 * backend leaves those out). None at all when there is nothing to show.
 * Pure, so both themes get the same words.
 */

/** The fewest stars an excerpt has; the backend asks the same (`min_rating`). */
export const EXCERPT_MIN_RATING = 4

const AVERAGE = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

const httpsOf = (value: string | null): string | null => {
  if (!value) {
    return null
  }
  try {
    return new URL(value).protocol === "https:" ? value : null
  } catch {
    return null
  }
}

type Answer = NonNullable<StoreGoogleReviews["google_reviews"]>

function excerptOf(
  review: Answer["reviews"][number],
  t: Translate
): GoogleRatingExcerptView | null {
  const text = review.comment?.replace(/\s+/g, " ").trim() ?? ""
  const rating = Math.round(review.rating)
  const date = new Date(review.created_at)
  if (
    text === "" ||
    rating < EXCERPT_MIN_RATING ||
    rating > 5 ||
    !Number.isFinite(date.getTime())
  ) {
    return null
  }
  const author = review.author?.trim() ?? ""
  return {
    author: author === "" ? t("reviews.google_anonymous") : author,
    rating,
    ratingLabel: t("reviews.stars", { rating }),
    text,
    date: { label: DATE.format(date), dateTime: date.toISOString() },
  }
}

export function googleRatingView(
  section: StoreGoogleRatingSection,
  answer: StoreGoogleReviews["google_reviews"] | undefined,
  t: Translate
): GoogleRatingSectionView | null {
  if (!answer) {
    return null
  }
  const rating =
    answer.rating !== null && Number.isFinite(answer.rating) && answer.rating > 0
      ? answer.rating
      : null
  // No average or no reviews on Google: no badge, rather than an empty box
  if (rating === null || answer.count < 1) {
    return null
  }
  const average = AVERAGE.format(rating)
  const excerpts = answer.reviews
    .flatMap((review) => {
      const view = excerptOf(review, t)
      return view ? [view] : []
    })
    .slice(0, section.excerpts)
  return {
    id: section.id,
    type: "google_rating",
    title: section.title ?? t("home.google_rating"),
    average,
    rating,
    label: t("reviews.google_label", { average, count: answer.count }),
    reviews: {
      label: t("home.google_rating_reviews", { count: answer.count }),
      path: "/yorumlar",
    },
    profileUrl: section.profile_link ? httpsOf(answer.maps_url) : null,
    excerpts,
  }
}
