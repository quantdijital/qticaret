/** What the product reviews module takes and gives (F10.6, adr/0037 §4). */

export interface ReviewInput {
  product_id: string
  customer_id: string
  order_id: string
  rating: number
  title: string | null
  body: string
  author_name: string
  has_link: boolean
  /** The author's uploads to show with it, in order; left out: its photos stay. */
  photo_ids?: string[] | undefined
}

/** A review the shop's old platform showed (F14), as it was. */
export interface MigratedReview {
  /** Its source and key there: one already written is not written again. */
  source_ref: string
  product_id: string
  customer_id: string | null
  rating: number
  title: string | null
  body: string
  author_name: string
  has_link: boolean
  /**
   * Shown on the old site: approved here, unless it carries a link (that
   * waits for the shop, as a new one would); one waiting there waits here.
   */
  published: boolean
  created_at: Date
}

export interface Rating {
  average: number
  count: number
}

/** How many approved reviews gave each number of stars, 5 to 1. */
export type RatingDistribution = Record<"1" | "2" | "3" | "4" | "5", number>
