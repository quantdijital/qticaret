import type {
  CardRatingView,
  CategoryCardView,
  CustomerPhotoView,
  ImageView,
  LinkView,
  ProductCardView,
  RatingBarView,
  ReviewPhotoView,
  ReviewReplyView,
  ShopMarkView,
  ShopRatingView,
  Translate,
} from "@qticaret/ui"
import { withCardBooking } from "./card-booking"
import { unrated } from "./card-shown"
import type {
  StoreCardFacts,
  StoreImage,
  StoreLatestReviewPhoto,
  StoreRatingDistribution,
  StoreReviewPhoto,
  StoreReviewReply,
  StoreReviewSummary,
} from "@qticaret/types"
import { imageView } from "./image"
import type { CardOptions } from "./product"

/**
 * The theme contract's optional fields (adr/0046 Ek 2026-11-04) from the
 * Store answers: pure, so both themes get the same words and numbers.
 */

/** A category's link with its picture, when it has one; the alt text falls back to its name. */
export function categoryCard(
  link: LinkView,
  image: StoreImage | null | undefined
): CategoryCardView {
  return image ? { ...link, image: imageView(image, link.label) } : link
}

const AVERAGE = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * A card's stars from its facts (adr/0062): the average in Turkish
 * ("4,3"), the count and the line a screen reader hears. None without an
 * approved review, or from a backend that does not answer it.
 */
export function cardRating(rating: StoreCardFacts["rating"], t: Translate): CardRatingView | null {
  if (!rating || !(rating.count > 0) || !Number.isFinite(rating.average)) {
    return null
  }
  const average = AVERAGE.format(rating.average)
  return {
    average,
    count: rating.count,
    label: t("product.card_rating", { average, count: rating.count }),
  }
}

/**
 * Cards with their stock bucket and quick add from the card facts. Quick
 * add goes only on a card that shows a price and can be bought now: the
 * facts are a moment younger than the card's own answer. The stars go on
 * only while the shop shows them (`product_card.show_rating`); otherwise
 * the field is left out of the view and no theme has it to draw.
 */
export function withCardFacts(
  cards: readonly ProductCardView[],
  facts: Readonly<Record<string, StoreCardFacts>>,
  options: Pick<CardOptions, "showRating">,
  t: Translate
): ProductCardView[] {
  return cards.map((card) => {
    const fact = facts[card.id]
    if (!fact) {
      return unrated(card)
    }
    const quick = fact.quick_add && card.price && card.available ? fact.quick_add : null
    const rating = options.showRating ? cardRating(fact.rating, t) : null
    // A dated product's from price and next departure (adr/0076 §10); any other card as it was
    const read = {
      ...withCardBooking(card, fact.booking, t),
      stock: fact.stock,
      quickAdd: quick ? { variantId: quick.variant_id } : null,
    }
    // A backend before the stars says nothing of reviews: no empty stars for it
    return rating ? { ...read, rating } : fact.rating === undefined ? unrated(read) : read
  })
}

const STARS = [5, 4, 3, 2, 1] as const

/** The stars' spread as bars, 5 to 1, each its share of all; none without a review. */
export function ratingBars(
  distribution: StoreRatingDistribution | null | undefined,
  t: Translate
): RatingBarView[] | null {
  if (!distribution) {
    return null
  }
  // A count the answer left out reads as none
  const countOf = (stars: (typeof STARS)[number]): number => {
    const count: unknown = distribution[String(stars) as keyof StoreRatingDistribution]
    return typeof count === "number" && Number.isFinite(count) ? count : 0
  }
  const total = STARS.reduce((sum, stars) => sum + countOf(stars), 0)
  if (total <= 0) {
    return null
  }
  return STARS.map((stars) => {
    const count = countOf(stars)
    return {
      stars,
      count,
      percent: Math.round((count / total) * 100),
      label: t("reviews.bar_label", { stars, count }),
    }
  })
}

/**
 * The shop's reviews in short (adr/0046 Ek 2026-11-05): the average in
 * Turkish ("4,6"), the count, the line a screen reader hears and the bars.
 * None without an approved review.
 */
export function shopRatingView(
  rating: StoreReviewSummary["rating"] | undefined,
  t: Translate
): ShopRatingView | null {
  const bars = ratingBars(rating?.distribution, t)
  if (!rating || !bars || !(rating.count > 0) || !Number.isFinite(rating.average)) {
    return null
  }
  const average = AVERAGE.format(rating.average)
  return {
    average,
    count: rating.count,
    label: t("product.card_rating", { average, count: rating.count }),
    distribution: bars,
  }
}

/** A photo on a review, its size known: no box jumps while it loads. */
export const reviewPhotoImage = (photo: StoreReviewPhoto, alt: string): ImageView => ({
  src: photo.url,
  alt,
  width: photo.width,
  height: photo.height,
  sources: { avif: null, webp: null },
})

/** A review's photos in the author's order, each named for a screen reader. */
export const reviewPhotos = (
  photos: readonly StoreReviewPhoto[] | undefined,
  author: string,
  t: Translate
): ReviewPhotoView[] =>
  (photos ?? []).map((photo, index) => ({
    image: reviewPhotoImage(photo, t("reviews.photo_alt", { author, n: index + 1 })),
  }))

const REPLY_DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

/**
 * The shop's reply under a review, as the themes show it: its words, the
 * shop's name, the day; none without words. Text only: a reply is not a
 * review and goes into no structured data.
 */
export function reviewReply(reply: StoreReviewReply | null | undefined): ReviewReplyView | null {
  const text = reply?.body.trim()
  if (!reply || !text) {
    return null
  }
  const when = new Date(reply.created_at)
  return {
    text,
    author: reply.author_name,
    date: Number.isNaN(when.getTime())
      ? { label: "", dateTime: "" }
      : { label: REPLY_DATE.format(when), dateTime: when.toISOString() },
  }
}

/** The newest customer photos, each at its product's page when the product has one. */
export function customerPhotos(
  photos: readonly StoreLatestReviewPhoto[],
  paths: Readonly<Record<string, string>>,
  t: Translate
): CustomerPhotoView[] {
  return photos.map((photo) => {
    const path = paths[photo.product.id]
    return {
      image: reviewPhotoImage(
        photo,
        t("reviews.customer_photo_alt", { product: photo.product.title })
      ),
      product: path ? { label: photo.product.title, path } : null,
      rating: photo.rating,
      author: photo.author_name,
    }
  })
}

/** The footer's ways to pay or carriers, by key, in the storefront's words. */
/**
 * The providers' own marks the storefront serves from `public/marks/`
 * (their sources in its README), by the backend's key, with each file's
 * size. A way to pay with no company's mark (a bank transfer, cash at the
 * door) has none: the theme draws its name.
 */
const MARK_LOGOS: Readonly<Record<string, { file: string; width: number; height: number }>> = {
  visa: { file: "visa.png", width: 208, height: 68 },
  mastercard: { file: "mastercard.svg", width: 41, height: 26 },
  troy: { file: "troy.svg", width: 298, height: 137 },
  amex: { file: "amex.svg", width: 24, height: 24 },
  paytr: { file: "paytr.png", width: 270, height: 48 },
  iyzico: { file: "iyzico.svg", width: 108, height: 38 },
  aras: { file: "aras.svg", width: 148, height: 40 },
  yurtici: { file: "yurtici.svg", width: 178, height: 44 },
}

export const shopMarks = (keys: readonly string[] | undefined, t: Translate): ShopMarkView[] =>
  (keys ?? []).map((key) => {
    const logo = MARK_LOGOS[key]
    return {
      key,
      label: t(`marks.${key}`),
      logo: logo ? { src: `/marks/${logo.file}`, width: logo.width, height: logo.height } : null,
    }
  })
