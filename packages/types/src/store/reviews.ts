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
  }[]
  count: number
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

/** One Google review as the storefront may show it (adr/0058): Google's words, the shop's not. */
export interface StoreGoogleReview {
  id: string
  /** As Google shows the reviewer; null for an anonymous one. */
  author: string | null
  /** Google's photo of the reviewer; null for none. */
  photo_url: string | null
  rating: number
  /** Null for a rating without text. */
  comment: string | null
  created_at: string
  /** The owner's reply as Google shows it. */
  reply: { comment: string; created_at: string | null } | null
}

/**
 * `GET /store/google-reviews?limit=` (adr/0058): the shop's Google reviews
 * from its Business Profile. Never in structured data (Google's review
 * snippet guidelines); null while there is nothing to show.
 */
export interface StoreGoogleReviews {
  google_reviews: {
    /** The business's name on Google. */
    title: string
    /** Google's own average, to one decimal; null while Google has none. */
    rating: number | null
    /** Google's own count of the place's reviews. */
    count: number
    /** The place on Google Maps, where every review is read. */
    maps_url: string | null
    /** Google's page to write a review. */
    write_url: string | null
    /** The newest the shop did not hide. */
    reviews: StoreGoogleReview[]
  } | null
}
