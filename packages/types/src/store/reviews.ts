/**
 * Product reviews as the Store API gives them (F10.6, adr/0037 §4): the
 * photos customers put on them and the stars' spread (adr/0046 Ek
 * 2026-11-04). A copy of the backend's answers (adr/0046 §8).
 */

/** How many approved reviews gave each number of stars. */
export type StoreRatingDistribution = Record<"1" | "2" | "3" | "4" | "5", number>

/** A photo on an approved review: stored cleaned, its size known. */
export interface StoreReviewPhoto {
  id: string
  url: string
  width: number
  height: number
}

/** `GET /store/products/:id/reviews`. */
export interface StoreProductReviews {
  /** None while no review is approved. */
  rating: {
    average: number
    count: number
    /** Absent from a backend before it. */
    distribution?: StoreRatingDistribution | null
  } | null
  reviews: {
    id?: string
    rating: number
    title: string | null
    body: string
    author_name: string | null
    created_at: string
    verified_purchase: boolean
    /** In the author's order; absent from a backend before it. */
    photos?: StoreReviewPhoto[]
    /** The shop's reply under it; absent from a backend before it. */
    reply?: StoreReviewReply | null
  }[]
  count: number
}

/**
 * The shop's public reply under a review: its words, the shop's name,
 * when. Text only: not a review, never in structured data.
 */
export interface StoreReviewReply {
  body: string
  author_name: string
  created_at: string
}

/** `GET /store/reviews/photos?limit=`: the newest photos on approved reviews, with their product. */
export interface StoreLatestReviewPhoto extends StoreReviewPhoto {
  review_id: string
  rating: number
  author_name: string
  created_at: string
  product: { id: string; title: string }
}

/** `GET /store/reviews/summary` (adr/0046 Ek 2026-11-05): the shop's approved reviews in short. */
export interface StoreReviewSummary {
  /** None while no review of a product the shopper may see is approved. */
  rating: {
    /** To one decimal. */
    average: number
    count: number
    distribution: StoreRatingDistribution
  } | null
}

/** `POST /store/products/:id/reviews/photos` (the bytes as the body): the upload's id for `photo_ids`. */
export interface StoreReviewPhotoUpload {
  photo: { id: string }
}
