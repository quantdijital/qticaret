import type {
  GoogleReviewView,
  GoogleReviewsView,
  ReviewsPageItemView,
  Translate,
} from "@qticaret/ui"
import type { StoreGoogleReview, StoreGoogleReviews } from "@qticaret/types"

/**
 * The shop's Google reviews for a theme (adr/0058), from the Store answer:
 * Google's own average and count, never one worked out from the reviews
 * shown; the reviewer as Google shows them; Google's links only over
 * https. Pure, so both themes get the same words.
 */

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

const dateOf = (value: string | null): { label: string; dateTime: string } | null => {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime())
    ? { label: DATE.format(date), dateTime: date.toISOString() }
    : null
}

/** A link out to Google over https, or none. */
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

function reviewView(review: StoreGoogleReview, t: Translate): GoogleReviewView | null {
  const date = dateOf(review.created_at)
  const rating = Math.round(review.rating)
  if (!date || rating < 1 || rating > 5) {
    return null
  }
  const reply = review.reply?.comment.trim()
  // An empty name or text is none
  const author = review.author?.trim() ?? ""
  const text = review.comment?.trim() ?? ""
  return {
    author: author === "" ? t("reviews.google_anonymous") : author,
    photo: review.photo_url,
    rating,
    ratingLabel: t("reviews.stars", { rating }),
    text: text === "" ? null : text,
    date,
    reply: reply ? { text: reply, date: dateOf(review.reply?.created_at ?? null) } : null,
  }
}

/** The view, or none when the backend has nothing to show (no location, nothing synced). */
export function googleReviewsView(
  answer: StoreGoogleReviews["google_reviews"] | undefined,
  t: Translate
): GoogleReviewsView | null {
  if (!answer) {
    return null
  }
  const reviews = answer.reviews.flatMap((review) => {
    const view = reviewView(review, t)
    return view ? [view] : []
  })
  const rating =
    answer.rating !== null && Number.isFinite(answer.rating) && answer.rating > 0
      ? answer.rating
      : null
  if (rating === null && reviews.length === 0) {
    return null
  }
  const average = rating === null ? null : AVERAGE.format(rating)
  return {
    average,
    rating,
    count: answer.count,
    label:
      average === null
        ? t("reviews.google_count", { count: answer.count })
        : t("reviews.google_label", { average, count: answer.count }),
    allUrl: httpsOf(answer.maps_url),
    writeUrl: httpsOf(answer.write_url),
    reviews,
  }
}

/**
 * A Google review as a card of the reviews page, mixed among the shop's
 * (adr/0058 Ek 2026-11-27): the same card, the owner's reply signed with
 * the shop's name, and where a review's product is, its link out to the
 * review on Google (`url`), else to the place (`mapsUrl`). Null for one
 * that cannot be shown (no date, stars out of range).
 */
export function googleReviewItem(
  review: StoreGoogleReview,
  mapsUrl: string | null,
  shopName: string,
  t: Translate
): ReviewsPageItemView | null {
  const view = reviewView(review, t)
  if (!view) {
    return null
  }
  return {
    rating: view.rating,
    title: null,
    body: view.text ?? "",
    author: view.author,
    date: view.date.label,
    verified: false,
    reply: view.reply
      ? {
          text: view.reply.text,
          author: shopName,
          date: view.reply.date ?? { label: "", dateTime: "" },
        }
      : null,
    product: null,
    google: {
      url: httpsOf(review.url) ?? httpsOf(mapsUrl),
      label: t("reviews.google_view_label", { author: view.author }),
    },
  }
}

/** One card with when its review was written, for `byDate`. */
export interface Dated<T> {
  at: string | null
  item: T
}

const timeOf = (at: string | null): number => {
  const time = at ? new Date(at).getTime() : Number.NaN
  return Number.isFinite(time) ? time : 0
}

/**
 * Two lists, each newest first, as one (adr/0058 Ek 2026-11-27): by date,
 * the shop's first on the same moment, as the backend cut the page.
 */
export function byDate<T>(shop: readonly Dated<T>[], google: readonly Dated<T>[]): T[] {
  const out: T[] = []
  let s = 0
  let g = 0
  for (;;) {
    const a = shop[s]
    const b = google[g]
    if (a && (!b || timeOf(a.at) >= timeOf(b.at))) {
      out.push(a.item)
      s += 1
    } else if (b) {
      out.push(b.item)
      g += 1
    } else {
      return out
    }
  }
}
